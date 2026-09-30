# Rishabh Kumar — Portfolio

Personal site of a backend engineer. Live at **https://rishabh-kumar.vercel.app**.

It is a portfolio plus a set of free developer tools at `/tools`. Two of the tools run on a real backend:

- **Webhook tester** (`/tools/webhook-tester`): gives a temporary URL and shows every request sent to it.
  `POST /api/hooks` creates a URL, any method on `/h/<id>` stores a request, `GET /api/hooks/<id>` lists them.
- **Live cache test** (`/tools/cache-test`): `POST /api/demo/cache` runs a real report 100 times straight from
  Postgres, then 100 times through Redis, and streams the measured timings back.
- **`GET /api/cron/keepalive`**: a daily job that keeps the free Postgres and Redis databases awake.

The other tools (JSON formatter, JWT decoder, Base64, Unix timestamp, cron explainer) run in the browser only.
`POST /api/contact` and `GET /api/rishabh` are still in the code but no page uses them at the moment.

A plain-English explanation of the whole backend is in [`public/how-it-works.md`](public/how-it-works.md).

## Stack

Next.js 16 (App Router, TypeScript) · Supabase (Postgres) · Upstash (Redis) · Resend (email) · Vercel (hosting + cron) · Zod

Functions run in Tokyo (`hnd1`, set in `vercel.json`) — the same AWS region as the database and Redis,
so the demo measures the databases, not the distance to them.

## How the webhook tester works

```
POST /api/hooks ─────────▶ limits, then HSET hook:<id> {key hash, seq, status} with a 24 h expiry
ANY  /h/<id>[/path] ─────▶ read at most 16 KB of body ─▶ one Lua script: exists? rate limit? LPUSH, LTRIM 50, EXPIRE
GET  /api/hooks/<id> ────▶ one Lua script: key hash matches? return only requests newer than ?after=<n>
```

- **Everything expires by itself.** Each key has a 24-hour TTL, so there is no cleanup job.
- **One Lua script per operation.** The limit check and the write are a single atomic step. Tested with 100
  requests at once against a 60-a-minute limit: exactly 60 accepted, 40 rejected.
- **Write-only URL.** The id in the URL can only add requests. Reading needs a separate view key that stays in the
  browser. Only its SHA-256 hash is stored.
- **Limits.** 10 new URLs per visitor per hour and 200 per day site-wide, 60 requests per URL per minute,
  120 reads per visitor per minute, newest 50 requests kept, bodies cut at 16 KB.
- **Polling with a cursor.** Serverless functions cannot hold a connection open, so the page polls with the number
  of the last request it has. It slows down when idle and stops in a background tab.
- **Signature check in the browser.** GitHub, Stripe and plain HMAC SHA-256 signatures are verified with Web Crypto,
  so the signing secret never reaches the server.

## How the contact form works

```
browser ──POST /api/contact──▶ Next.js route handler ──rpc──▶ Postgres function ──▶ contact_messages
                                  │  1. same-origin check                 │  rate limit + insert,
                                  │  2. 10 KB body limit                  │  in one transaction
                                  │  3. Zod validation
                                  │  4. honeypot → silent 201
                                  └─ 5. after save: email via Resend
```

- **The table is never exposed.** Row Level Security is on with no policies, and all table privileges are revoked.
  The public key can only call specific database functions (`submit_contact()`, `ping()` and the demo's three), never a table.
- **Rate limiting lives in the database.** At most 3 messages per visitor per 10 minutes and 50 per hour site-wide,
  checked and inserted in one transaction. `pg_advisory_xact_lock` stops parallel requests slipping past the limit.
- **No raw IPs are stored.** Only a salted SHA-256 hash, which is enough to rate-limit.
- **Email only goes to me.** The visitor's address is used as `Reply-To`, never as a recipient,
  so the form can't be abused to send spam to anyone else.
- **A failed email isn't an error for the visitor.** The message is already saved, and resubmitting would only duplicate it.

## How the cache test works

```
click ──POST /api/demo/cache──▶ gate in Postgres: demo_try_start() ──▶ 429 + Retry-After if not allowed
                                   │
                                   ├─ phase 1: 100 × demo_top_products()   (10 in flight)   ──▶ Postgres
                                   ├─ phase 2: 100 × cache-aside lookup    (10 in flight)   ──▶ Redis, Postgres on a miss
                                   └─ streams NDJSON progress, then the result: total, p50, p95, hits, queries
```

- **The query is real work.** `demo_top_products()` ranks products by revenue across 100,000 orders, with unique
  buyers per product. Postgres has no result cache, so every call scans and aggregates the whole table again.
- **Cache-aside, starting cold.** Each run clears the key first, so the first lookups really miss. A miss loads from
  Postgres and stores the result with a 60-second TTL.
- **No cache stampede.** The first wave of 10 parallel lookups all miss at once. They share one in-flight Postgres
  query (request coalescing) instead of sending 10 identical ones.
- **Correctness check.** Both phases must return the same answer, and the page shows it. A fast wrong answer is a bug.
- **The gate lives in Postgres, not Redis — on purpose.** Supabase API calls are unmetered; the free Redis plan
  counts every command. Blocked requests never touch Redis, so abuse can't burn the Redis quota.
  One transaction with `pg_advisory_xact_lock` enforces:
  - one run at a time, site-wide (clean timings, calm free-tier database)
  - 3 runs per visitor per hour, 10 per day — then the button locks with a countdown to the exact minute the limit lifts
  - 100 runs per day site-wide
- **Budget with a hard ceiling.** A run uses about 102 Redis commands, so the daily cap limits Redis to about
  310K commands a month, under the free plan's 500K. None of the free plans have a card attached, so the worst
  case is the demo pausing until the next day — never a bill, and never the rest of the site.
- **Bounded.** A run is aborted after 20 seconds or when the visitor leaves. A crashed run stops blocking others after 30.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```

## Database

The schema lives in `supabase/migrations/`. Apply it with the Supabase CLI (included as a dev dependency):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or paste the migration file into Supabase → SQL Editor → Run.

## Deploy (Vercel)

1. Import this repository at vercel.com/new. The project name decides the URL (`rishabh-kumar` → `rishabh-kumar.vercel.app`).
2. Add every variable from `.env.example` in Project → Settings → Environment Variables.
3. Deploy. The daily keep-alive cron is picked up from `vercel.json` automatically.
