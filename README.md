# Rishabh Kumar — Portfolio

Personal site of a Node.js backend engineer. Live at **https://rishabh-kumar.vercel.app**.

It's a normal portfolio with a small, real backend behind it:

- **`GET /api/rishabh`** — the card on the homepage calls this endpoint and shows the real response and round-trip time.
- **`POST /api/contact`** — the contact form. Validated, rate-limited, stored in Postgres, and delivered by email.
- **`GET /api/cron/keepalive`** — a daily job that keeps the free database awake.

## Stack

Next.js 16 (App Router, TypeScript) · Supabase (Postgres) · Brevo (transactional email) · Vercel (hosting + cron) · Zod

## How the contact form works

```
browser ──POST /api/contact──▶ Next.js route handler ──rpc──▶ Postgres function ──▶ contact_messages
                                  │  1. same-origin check                 │  rate limit + insert,
                                  │  2. 10 KB body limit                  │  in one transaction
                                  │  3. Zod validation
                                  │  4. honeypot → silent 201
                                  └─ 5. after save: email via Brevo
```

- **The table is never exposed.** Row Level Security is on with no policies, and all table privileges are revoked.
  The public key can only call two functions: `submit_contact()` and `ping()`.
- **Rate limiting lives in the database.** At most 3 messages per visitor per 10 minutes and 50 per hour site-wide,
  checked and inserted in one transaction. `pg_advisory_xact_lock` stops parallel requests slipping past the limit.
- **No raw IPs are stored.** Only a salted SHA-256 hash, which is enough to rate-limit.
- **Email only goes to me.** The visitor's address is used as `Reply-To`, never as a recipient,
  so the form can't be abused to send spam to anyone else.
- **A failed email isn't an error for the visitor.** The message is already saved, and resubmitting would only duplicate it.

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
