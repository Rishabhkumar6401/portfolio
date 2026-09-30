# How this portfolio works

A plain-English tour of the backend behind **rishabh-kumar.vercel.app**: what happens when you click things,
which tools I picked, and why.

---

## In 30 seconds

The site is a portfolio with a set of developer tools. Two of the tools are real backend features:

| Feature | What you see | What actually happens |
|---|---|---|
| **Webhook tester** (`/tools/webhook-tester`) | A temporary URL, and every request sent to it | My server stores each request in Redis for 24 hours. Limits, expiry and access are enforced on the server. |
| **Live cache test** (`/tools/cache-test`) | A table of measured times | My server runs a real database report 200 times (100 straight from Postgres, 100 through a Redis cache) and streams the measured times back to you. |

The other tools (JSON formatter, JWT decoder, Base64, Unix timestamp, cron) run entirely in the browser. They
send nothing to the server.

Plus one job you never see: a daily **keep-alive** task, so the free database services never fall asleep.

Everything runs on free plans, and every feature is protected against spam and abuse.

---

## The tools, and why I picked them

| Tool | Its job here | Why this one | Everyday comparison |
|---|---|---|---|
| **Next.js** (React + TypeScript) | Builds the page *and* the API endpoints | One codebase for the front end and the back end | A shop where the showroom and the back office share one building |
| **Vercel** | Hosts the site and runs the API code | Free, fast, and deploys automatically on every `git push` | The landlord who also keeps the lights on |
| **Supabase** (PostgreSQL) | Stores the cache test's 100,000 orders and its rate-limit records | A real Postgres database on a generous free plan | A filing cabinet in a locked room |
| **Upstash** (Redis) | Stores the webhook tester's requests, and is the cache in the cache test | Redis over HTTPS — no server to run, free plan | A sticky note on your monitor |
| **Zod** | Checks every input before the server trusts it | Clear rules and clear error messages | The guard checking IDs at the door |

### Everything lives in one city: Tokyo

- My server code runs in Vercel's **Tokyo** region.
- The Postgres database is in **Tokyo** (AWS).
- Redis is in **Tokyo** too (Google Cloud).

**Why it matters:** if the server sat in the USA and the database in Tokyo, every single question would travel
across the Pacific and back — roughly 150 ms per trip. The cache test would then measure *distance*, not
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
   │  2. The two backend tools call my API endpoints
   ▼
Vercel functions — Tokyo
   ├── POST /api/hooks            → create a test URL (Redis)
   ├── ANY  /h/<id>               → receive a request on a test URL and store it (Redis)
   ├── GET  /api/hooks/<id>       → the page asks "anything new?" (Redis)
   ├── POST /api/demo/cache       → Postgres (the report + the limits) and Redis (the cache)
   └── GET  /api/cron/keepalive   → pings Postgres and Redis once a day
```

---

## 1. The webhook tester

### What a webhook is, with a shop example

You order a parcel. You could phone the courier every ten minutes to ask "is it here yet?", or the courier could
ring your doorbell when it arrives. A webhook is the doorbell: instead of my server asking Stripe again and
again whether a payment happened, Stripe sends a request to my server the moment it does.

The hard part for a developer is that you cannot see that request. It goes from Stripe's server to yours. The
webhook tester gives you a temporary address to hand to Stripe (or GitHub, or anything else), and shows you
exactly what arrived.

### What happens, step by step

**Creating a URL** (`POST /api/hooks`)

1. The server checks the limits: 10 new URLs per visitor per hour, 200 per day for the whole site.
2. It makes two random values: an **id** (goes in the URL) and a **view key** (goes back to your browser only).
3. It stores the URL in Redis with a 24-hour expiry. It stores a SHA-256 hash of the view key, not the key.
4. Your browser keeps the id and the key, so a page reload brings the same URL back.

**A request arrives** (any method on `/h/<id>`)

1. The server reads the body, but only the first 16 KB. If the upload is bigger it stops reading.
2. It builds a record: method, path, query, headers, body, sender IP, time.
3. One Lua script in Redis then does everything in a single step: check the URL still exists, count the
   request against the limit (60 a minute), add it to the list, trim the list to the newest 50, and give the
   list the same expiry as the URL.
4. The sender gets the reply status you chose (200 by default).

**The page checks for new requests** (`GET /api/hooks/<id>?after=<n>`)

1. The browser sends the view key in a header and the number of the last request it already has.
2. One Lua script checks the key hash and returns only the requests newer than that number.
3. The page asks every 2 seconds while things are happening, every 5 seconds after two quiet minutes, not at
   all while the tab is in the background, and it pauses after 15 quiet minutes.

### Why Redis, and not Postgres

This data is temporary by nature. Every request is wanted for a day at most. Redis can put an expiry on each
key, so old data deletes itself. With Postgres I would need a scheduled job to delete old rows, and a forgotten
job means a table that grows forever.

Redis lists also fit the shape of the data: "add to the front, keep the newest 50" is two built-in commands.

### Why a Lua script: the two-requests-at-once problem

Storing a request needs several Redis commands: read the counter, compare it with the limit, add one, save the
request, trim the list. If my server sent them one by one, two requests arriving together could both read
"59 of 60 used", both decide they are allowed, and both get in. The limit would leak.

A Lua script runs inside Redis as one uninterrupted step. Nothing else can run in the middle of it. So the
check and the write can never be separated.

> I tested this: 100 requests sent to one URL, 25 at a time. Exactly 60 were accepted, exactly 40 got
> "429 Too Many Requests", the counter said 60 and the list held the newest 50.

### Two secrets, not one

Most tools of this kind use one secret: whoever knows the URL can read everything sent to it. But the URL is
exactly the thing you paste into other companies' dashboards, so it is the secret most likely to leak.

Here the URL can only **add** requests. **Reading** them needs the view key, which never leaves your browser
except to talk to my API. The server keeps only a hash of it, the same way a password is stored. If someone
copied my Redis database, they still could not read anyone's requests through the API.

### The limits

| Limit | Value | Why |
|---|---|---|
| New URLs per visitor | 10 an hour | Stops one person filling the store |
| New URLs, whole site | 200 a day | Keeps the worst case inside the free Redis plan |
| Requests per URL | 60 a minute | A webhook sender in a retry loop cannot flood it |
| Requests kept per URL | newest 50 | Bounded storage |
| Body size kept | 16 KB | Bounded storage; larger bodies are cut and marked |
| Page checks per visitor | 120 a minute | The read API cannot be hammered either |
| Lifetime | 24 hours | Everything deletes itself |

Visitors are counted by a salted hash of their IP address, so the counters do not hold raw addresses.

### Why the page asks again and again, instead of a live connection

A live connection (WebSocket) needs a server that stays up and holds the connection open. This site runs on
serverless functions: each one starts, answers, and stops. It cannot hold a connection for minutes.

So the page polls. The cost of polling is wasted requests when nothing is new, which is why the page sends the
number of the last request it has (the answer is then tiny), slows down when it is quiet, and stops in a
background tab.

### Checking a signature

Services sign their webhooks: they compute an HMAC of the body with a secret only you and they know, and send
it in a header. The page can recompute it and tell you whether it matches. This runs in your browser with the
built-in crypto API, so the signing secret is never sent to my server. It understands the GitHub format
(`sha256=<hex>`), the Stripe format (`t=<time>,v1=<signature>`, signed over `<time>.<body>`), and a plain hex or
Base64 HMAC.

For this to work the stored body must be byte-for-byte what was sent. That is why the server stores text as
text only when it is valid UTF-8, keeps a leading byte-order mark, and stores anything else as Base64.

### Testing retries

You can set the URL to reply 500 or 503. The sender then believes the delivery failed and retries, and you can
watch its retry schedule. Redirect codes are not offered on purpose: a URL that redirects anywhere could be
abused to disguise links.

### If someone asks "what would you change at real scale?"

- Use a server that can hold connections (or a push service) and send new requests to the page instantly.
- Put request bodies in object storage and keep only the index in Redis, so large bodies are possible.
- Add accounts, so a URL can live longer than a day and belong to a team.
- Add forwarding to a developer's own machine, so the request can be replayed against local code.

---

## 2. The live cache test

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
the window rolls over. The other tools keep working, and everything runs on free
plans with no card attached, so there's never a surprise bill.

---

## 4. Security, in plain words

**The database is locked; the website talks to a clerk at a counter.** Every table has Row Level Security
switched on, with no rules and no permissions — so nobody can read or write a table directly, not even with the
site's own key. The site can only call a short list of database functions, and each does one specific job:

| Function | Its job |
|---|---|
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

## 5. Keeping the free services awake

Free plans go to sleep when nobody uses them: Supabase pauses a project after 7 days without activity, and
Upstash archives a free Redis database after 30 days.

So Vercel runs a small scheduled job every day at **06:00 UTC** that pings both. The job only works with a
secret password in its request, so nobody else can trigger it.

---

## 6. What it costs: nothing

| Service | Free plan | This site's use |
|---|---|---|
| **Vercel** (Hobby) | 1 million function calls a month | Low — the page itself is a static file |
| **Supabase** | 500 MB database | About 9 MB (mostly the demo's 100,000 orders) |
| **Upstash Redis** | 500,000 commands a month | Cache test: at most about 306,000, capped by its daily limit. Webhook tester: one command per stored request and per page check, capped by its own limits |

On free plans with no card attached, going over a limit pauses that one feature — it never creates a bill.

---

## 7. Questions I'm often asked

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
- Use a Redis plan sized for the traffic, and move the rate limiter there, where it's fastest.

---

## 8. Where things live in the code

| What | File |
|---|---|
| All page text and profile data | `src/content/profile.ts` |
| Names and page text of the tools | `src/content/tools.ts` |
| Webhook tester: storage, limits and the Lua scripts | `src/lib/hooks.ts` |
| Webhook tester: create a URL | `src/app/api/hooks/route.ts` |
| Webhook tester: read, change reply status, delete | `src/app/api/hooks/[id]/route.ts` |
| Webhook tester: receive a request | `src/app/h/[id]/[[...path]]/route.ts` |
| Webhook tester: the page | `src/components/tools/WebhookTester.tsx` |
| Cache test endpoint (gate + streaming) | `src/app/api/demo/cache/route.ts` |
| Cache test logic (the two rounds, cache-aside, coalescing, stats) | `src/lib/cacheDemo.ts` |
| Cache test: the page | `src/components/tools/CacheTest.tsx` |
| Browser-only tools | `src/components/tools/`, `src/lib/cron.ts`, `src/lib/json.ts` |
| Redis client | `src/lib/redis.ts` |
| Daily keep-alive | `src/app/api/cron/keepalive/route.ts` |
| Database tables, functions and limits | `supabase/migrations/` |
| Server region and daily schedule | `vercel.json` |
