# How this portfolio works

A plain-English tour of the backend behind **rishabh-kumar.vercel.app**: what happens when you click things,
which tools I picked, and why.

---

## In 30 seconds

The site looks like a normal portfolio, but three parts of it are real backend features:

| Feature | What you see | What actually happens |
|---|---|---|
| **Live API card** (top of the page) | A request to `/api/rishabh` and its JSON answer | A real HTTP request from your browser to my server. The time shown is measured in your browser. |
| **Caching demo** ("Why caching matters") | Two progress bars and their timings | My server runs a real database report 200 times — 100 straight from Postgres, 100 through a Redis cache — and streams the measured times back to you. |
| **Contact form** | "Thanks, your message is in my inbox" | Your message is checked, rate-limited, saved in a database and emailed to me. |

Plus one job you never see: a daily **keep-alive** task, so the free database services never fall asleep.

Everything runs on free plans, and every feature is protected against spam and abuse.

---

## The tools, and why I picked them

| Tool | Its job here | Why this one | Everyday comparison |
|---|---|---|---|
| **Next.js** (React + TypeScript) | Builds the page *and* the API endpoints | One codebase for the front end and the back end | A shop where the showroom and the back office share one building |
| **Vercel** | Hosts the site and runs the API code | Free, fast, and deploys automatically on every `git push` | The landlord who also keeps the lights on |
| **Supabase** (PostgreSQL) | Stores contact messages, the demo's 100,000 orders, and the rate-limit records | A real Postgres database on a generous free plan | A filing cabinet in a locked room |
| **Upstash** (Redis) | The cache in the caching demo | Redis over HTTPS — no server to run, free plan | A sticky note on your monitor |
| **Resend** | Emails me when someone sends a message | Simple API, free plan, no domain setup needed | The postman |
| **Zod** | Checks every input before the server trusts it | Clear rules and clear error messages | The guard checking IDs at the door |

### Everything lives in one city: Tokyo

- My server code runs in Vercel's **Tokyo** region.
- The Postgres database is in **Tokyo** (AWS).
- Redis is in **Tokyo** too (Google Cloud).

**Why it matters:** if the server sat in the USA and the database in Tokyo, every single question would travel
across the Pacific and back — roughly 150 ms per trip. The caching demo would then measure *distance*, not
*databases*.

I saw this for myself while building it: running the demo from my laptop in India, every call travelled to Tokyo
and back (about 150 ms), and the cache looked only about 2× faster — the travel time drowned out the difference.
On the live site, the server sits next to both databases, so the timings reflect the databases themselves.

---

## The big picture

```
Your browser
   │
   │  1. The page itself comes from Vercel's CDN (a copy stored close to you)
   │  2. Buttons and the form call my API endpoints
   ▼
Vercel functions — Tokyo
   ├── GET  /api/rishabh          → answers from code, no database
   ├── POST /api/demo/cache       → Postgres (the report + the limits) and Redis (the cache)
   ├── POST /api/contact          → Postgres (limits + save), then Resend (email me)
   └── GET  /api/cron/keepalive   → pings Postgres and Redis once a day
```

---

## 1. The live API card

**What happens when you press "Send request":**

1. Your browser sends `GET /api/rishabh` to my server.
2. The server replies with a small JSON profile: name, role, stack, location.
3. Your browser measures how long the round trip took and shows it, e.g. `200 OK · 43 ms`.
4. The answer is typed out on screen.

The card also sends one request by itself the first time it scrolls into view.

**The CDN copy.** The response carries this header:

```
Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400
```

In plain words: Vercel's CDN may keep a copy of the answer for an hour, so most requests are answered by a
server near you without running my code at all. After that hour, it can keep handing out the old copy for up to
a day while it quietly fetches a fresh one. My profile hardly ever changes, so that's perfectly fine.

> Real-world version: a newspaper. It's printed once, and every newsstand hands out copies — nobody reprints
> the paper for each reader.

**"Send it ten times or once — same effect on the server."** That line is about **idempotency**. A `GET` only
reads; it never changes anything. Asking a shopkeeper "what time is it?" ten times changes nothing. Pressing
**Pay** ten times on a checkout page is different — that must not charge you ten times, which is why payment
APIs are deliberately built to be idempotent.

**Anyone can call it.** It's public, read-only data, so it accepts requests from any website
(`Access-Control-Allow-Origin: *`). Try it from a terminal:

```bash
curl https://rishabh-kumar.vercel.app/api/rishabh
```

---

## 2. The caching demo

### The problem caching solves — a shop example

A shop keeps 100,000 receipts in a box. The owner asks: **"What are our top 5 products?"**

- **Without a cache:** a clerk goes through all 100,000 receipts, adds everything up, and answers. A minute later
  someone asks again — the clerk counts everything again. Ask 100 times, and the clerk counts 100 times.
- **With a cache:** the clerk counts once and writes the answer on a whiteboard. For the next 60 seconds,
  anyone who asks just reads the whiteboard.

The demo does exactly this, with a database instead of a box of receipts.

### What one click does

1. **Gate check** — are you allowed to run it right now? (See [section 3](#3-protecting-the-demo-from-abuse).)
   If not, you get a short message and a countdown, and nothing else runs.
2. **Round 1 — Postgres only.** The server asks Postgres for the report **100 times, 10 at a time** — like 10
   visitors asking at once. Every single time, Postgres scans all 100,000 orders, groups them by product, counts
   unique buyers, adds up revenue, and returns the top 5.
3. **Round 2 — through Redis.** The server empties the cache first, so it starts cold. Then it asks for the same
   report 100 times, 10 at a time, using the "check the whiteboard first" pattern.
4. **Results** — total time, the slow-end time (p95), how many times the database really worked, and whether
   both rounds gave the same answer.

While this runs, the server **streams progress** to your browser after every 10 lookups. That's why the bars
move while the work happens, instead of everything appearing at the end.

> Real-world version: a parcel tracker — "packed → shipped → out for delivery" — instead of silence until the
> parcel shows up.

You can watch it yourself: open **DevTools → Network**, press the button, and click the `cache` request.
Each line of the response is one progress update, and the last line holds the final numbers.

### The report itself

```sql
select product_id,
       count(*)                    as orders,
       count(distinct customer_id) as buyers,
       sum(amount)                 as revenue
from demo_orders
group by product_id
order by revenue desc
limit 5;
```

The 100,000 orders are generated sample data: 500 products and 20,000 customers, where popular products sell
far more — like a real shop. They're generated with a fixed random seed, so the answer is identical every time.

Postgres does keep recently used data in memory, but it doesn't remember *answers*: it redoes the counting and
grouping on every call. That repeated work is exactly what the cache saves.

### Cache-aside — "check the whiteboard first"

For every lookup in round 2:

1. Look in Redis for a saved answer.
2. **Found it** — a *cache hit*. Return it. That takes a few milliseconds.
3. **Not there** — a *cache miss*. Ask Postgres, save the answer in Redis for 60 seconds, then return it.

This pattern is called **cache-aside**, and it's the most common way to add a cache to an existing app.

**Why the saved answer expires after 60 seconds (the TTL).** A cache trades freshness for speed. If a new order
arrives, the whiteboard keeps showing the old top 5 until it expires. For a "top sellers" list, a minute-old
answer is fine. For a bank balance, it wouldn't be. Choosing that trade-off — and knowing when to wipe the
whiteboard early — is why people say *cache invalidation is one of the two hard problems in computer science*.

### The stampede problem, and how I avoid it

Round 2 starts with an empty cache and 10 lookups at the same moment. All 10 check the whiteboard, all 10 find
it empty, and — in a naive cache — all 10 go off to count the receipts. That's a **cache stampede**: the moment
the cache is empty is exactly when the database gets hammered hardest.

My fix is **request coalescing**. The first miss starts the database query; the other 9 don't start their own —
they wait for that same answer.

> Real-world version: ten customers ask the same question at once. One clerk counts the receipts, and the other
> nine customers wait for that clerk — instead of nine more clerks counting the same box.

That's why the result line reads something like **"90 cache hits · 10 misses → 1 database query"**.

### Reading the numbers

| You see | It means |
|---|---|
| **Total time** (e.g. `1.84 s`) | How long all 100 lookups took |
| **p95** (e.g. `p95 24 ms`) | The slow end: 95 out of 100 lookups were faster than this. Averages hide slow requests; p95 shows what your unluckiest visitors feel. |
| **× faster** | Postgres total time ÷ Redis total time |
| **1 database query instead of 100** | The real win. Fewer queries means the same database can serve far more visitors. |
| **Same answer both ways ✓** | The server compares both results. A fast wrong answer is a bug, not a feature. |

The raw response in DevTools also includes **p50**, the typical lookup: half were faster, half slower.

The numbers change a little on every run, because they're live measurements — network conditions and the
database's workload vary from moment to moment.

---

## 3. Protecting the demo from abuse

Every run does real work, so the button needs limits. *"What if someone clicks it a thousand times?"*

### The limits

| Rule | Why |
|---|---|
| **One run at a time**, for the whole site | Clean timings, and the free database never gets overloaded |
| **3 runs per visitor per hour** | Enough to see the numbers change. Then the button locks with a countdown. |
| **10 runs per visitor per day** | Stops someone coming back every hour, all day |
| **100 runs per day** for the whole site | A hard ceiling on total cost, even if many people — or bots — try at once |

If another visitor's run is already going, your page waits and retries by itself ("Waiting in line…").

### Why the limits live in Postgres, not Redis

Rate limiters are usually built in Redis. So why not here? Because of how the free plans are measured:

- **Upstash Redis (free)** counts every command — 500,000 a month.
- **Supabase (free)** doesn't count API requests.

If the limiter lived in Redis, every *blocked* click would still spend Redis commands, and a bot hammering the
button could burn the whole month's quota — breaking the demo even though every one of its clicks was blocked.
With the check in Postgres, **a blocked click never touches Redis at all.**

That gives Redis a hard monthly ceiling:

```
1 run     = 1 DEL + 100 GET + 1 SET  = 102 Redis commands
100 runs a day × 102 × 30 days       ≈ 306,000 a month   (free plan: 500,000)
```

So even on the busiest possible day, the demo stays inside the free plan.

### Two clicks at the exact same moment

If two people click in the same millisecond, both checks could read "nothing is running" and both start. To
stop that, the check takes a database lock first (`pg_advisory_xact_lock`), so checks happen strictly one after
another.

> Real-world version: a cinema with one ticket counter. Two people can't both buy the last seat, because the
> counter serves one person at a time.

### "Try again in 42 min" — exact, not a guess

The limits use **rolling windows** — "3 in the last 60 minutes", not "3 per clock hour". When you hit a limit,
the database works out exactly when your oldest run in the window turns an hour old, and returns that number of
seconds. The page counts it down on the button.

### How the site recognises you — without storing who you are

To count "3 runs per visitor", the server has to recognise a returning visitor, but I don't want to store IP
addresses. So it stores only a **salted hash** of the IP: a scrambled fingerprint that can answer "same visitor
as before?" but can't be turned back into the IP address.

> Real-world version: a cloakroom token. The attendant knows token #42 already collected a coat, without ever
> writing down your name.

### When something goes wrong mid-run

- **You close the tab** → the server notices and stops the run straight away.
- **A run gets stuck** → it's stopped after 20 seconds.
- **The server crashes mid-run** → the "one run at a time" slot frees itself after 30 seconds.

### The worst case

A determined attacker could use up the day's 100 runs. The demo then shows a "come back later" countdown until
the window rolls over. Nothing else is affected: the contact form doesn't use Redis, and everything runs on free
plans with no card attached, so there's never a surprise bill.

---

## 4. The contact form

When you press **Send message**, the request passes these checks, in this order:

1. **Same site only.** Requests from other websites' pages are rejected.
2. **Size limit.** Anything over 10 KB is rejected.
3. **Validation (Zod).** Name up to 80 characters with no line breaks or `< >`; a valid email address; a message
   of 10–2,000 characters. The browser runs the same checks for friendly error messages, but only the server's
   check is trusted.
4. **Honeypot.** The form has a hidden field that people can't see, but bots fill in. If it's filled, the server
   says "thanks" and quietly throws the message away.
   > Real-world version: a fake "staff only" door that only burglars try to open.
5. **Rate limit and save, in one step.** A database function checks the limits — 3 messages per visitor per
   10 minutes, 50 per hour for the whole site — and saves the message in the same transaction, so two quick
   submissions can't both slip past the limit.
6. **Email me.** Resend delivers the message to my inbox.

**Details that matter:**

- **Email only ever goes to me.** Your address is set as *Reply-To*, never as a recipient — so nobody can use my
  form to send spam to someone else.
- **If the email fails, you still see success.** Your message is already saved in the database. Showing an
  error would only make you send it twice.
- **No line breaks allowed in the name.** Email headers are separated by line breaks, so a name with hidden line
  breaks could smuggle in extra headers. The validation rule blocks that.

---

## 5. Security, in plain words

**The database is locked; the website talks to a clerk at a counter.** Every table has Row Level Security
switched on, with no rules and no permissions — so nobody can read or write a table directly, not even with the
site's own key. The site can only call a short list of database functions, and each does one specific job:

| Function | Its job |
|---|---|
| `submit_contact` | Check the limits and save one message |
| `ping` | Say "I'm awake" |
| `demo_top_products` | Run the demo report |
| `demo_try_start` / `demo_finish` | Open and close a demo run (this is where the limits live) |

> Real-world version: a bank. You can't walk into the vault — you ask the teller, and the teller only does
> specific, approved things.

I checked this on the live database: trying to read any table with the site's key returns *permission denied*.

**Secrets stay on the server.** API keys live in Vercel's environment settings, never in the code. I checked the
JavaScript your browser downloads: no keys or tokens are in it.

**Safety headers on every page.** The browser is told not to guess file types, not to let other sites embed this
page in a frame, to share only minimal referrer information, and that camera, microphone and location are off.

---

## 6. Keeping the free services awake

Free plans go to sleep when nobody uses them: Supabase pauses a project after 7 days without activity, and
Upstash archives a free Redis database after 30 days.

So Vercel runs a small scheduled job every day at **06:00 UTC** that pings both. The job only works with a
secret password in its request, so nobody else can trigger it.

---

## 7. What it costs: nothing

| Service | Free plan | This site's use |
|---|---|---|
| **Vercel** (Hobby) | 1 million function calls a month | Low — the page itself is a static file |
| **Supabase** | 500 MB database | About 9 MB (mostly the demo's 100,000 orders) |
| **Upstash Redis** | 500,000 commands a month | At most about 306,000, capped by the daily limit |
| **Resend** | 100 emails a day, 3,000 a month | One per contact message |

On free plans with no card attached, going over a limit pauses that one feature — it never creates a bill.

---

## 8. Questions I'm often asked

**Are the demo's numbers measured live?**
Yes. Open DevTools → Network, press the button, and you'll see the `cache` request streaming results line by
line. The numbers differ slightly on every run.

**Why is Redis faster than Postgres here?**
Not because Postgres is slow — because it's doing far more work. Each Postgres call adds up 100,000 orders.
Each Redis call hands back an answer that was already worked out, straight from memory.

**Then why not cache everything?**
Because a cache can serve old data. The demo's answer can be up to 60 seconds old — fine for a top-sellers
list, wrong for a bank balance. Caching is always a trade-off between speed and freshness.

**What's a cache stampede?**
When the cache is empty and many requests arrive together, they all miss and all hit the database at once. I
prevent it with request coalescing: one database query, and everyone else waits for its answer.

**Why is the rate limiter in Postgres and not Redis?**
Free Redis counts every command; free Supabase doesn't. With the limiter in Postgres, blocked clicks cost zero
Redis commands, which gives the demo a hard monthly ceiling.

**What happens if two people click at the same moment?**
One run starts; the other visitor's page waits and retries by itself. A database lock guarantees that only one
run can start.

**What if someone floods the whole site?**
Every feature has its own limits, and Vercel's built-in DDoS protection sits in front of everything. The honest
worst case on a free plan is that a service pauses until its limit resets — no data is exposed, and no bill is
created.

**How would you build this at a company with real traffic?**
- Pre-compute the report (a summary table or materialized view refreshed every minute), so even a cache miss
  is cheap.
- Clear the cache when orders change (event-based invalidation), instead of only waiting for it to expire.
- Monitor the cache hit rate, p95 latency and error rate, with alerts.
- Send emails from a queue with retries, so a slow email provider never slows down the form.
- Use a Redis plan sized for the traffic, and move the rate limiter there, where it's fastest.

---

## 9. Where things live in the code

| What | File |
|---|---|
| All page text and profile data | `src/content/profile.ts` |
| API card endpoint | `src/app/api/rishabh/route.ts` |
| Caching demo endpoint (gate + streaming) | `src/app/api/demo/cache/route.ts` |
| Demo logic (the two rounds, cache-aside, coalescing, stats) | `src/lib/cacheDemo.ts` |
| Redis client | `src/lib/redis.ts` |
| Contact form endpoint | `src/app/api/contact/route.ts` |
| Email sending | `src/lib/notify.ts` |
| Daily keep-alive | `src/app/api/cron/keepalive/route.ts` |
| Database tables, functions and limits | `supabase/migrations/` |
| Server region and daily schedule | `vercel.json` |
