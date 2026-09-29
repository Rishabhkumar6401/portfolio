-- Portfolio contact form — run once in Supabase: Dashboard → SQL Editor → paste → Run.
--
-- Design:
--   * The table is locked down completely (RLS on, no policies, privileges revoked).
--   * The website can only call two functions:
--       submit_contact(...)  validates, rate-limits and inserts one message
--       ping()               cheap query used by the daily keep-alive cron
--   * Raw IPs are never stored — only a salted SHA-256 hash, enough to rate-limit.

create table if not exists public.contact_messages (
  id          bigint generated always as identity primary key,
  name        text        not null check (char_length(name) between 1 and 80),
  email       text        not null check (char_length(email) between 3 and 120),
  message     text        not null check (char_length(message) between 10 and 2000),
  ip_hash     text        not null,
  created_at  timestamptz not null default now()
);

create index if not exists contact_messages_ip_recent_idx
  on public.contact_messages (ip_hash, created_at desc);

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;

-- Rate limits: 3 messages per visitor per 10 minutes, 50 per hour site-wide.
create or replace function public.submit_contact(
  p_name text, p_email text, p_message text, p_ip_hash text
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id bigint;
begin
  -- Serialise concurrent submissions from the same visitor so two parallel
  -- requests can't both slip under the limit.
  perform pg_advisory_xact_lock(hashtext(p_ip_hash));

  if (select count(*) from contact_messages
        where ip_hash = p_ip_hash and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'rate_limited';
  end if;

  if (select count(*) from contact_messages
        where created_at > now() - interval '1 hour') >= 50 then
    raise exception 'rate_limited';
  end if;

  insert into contact_messages (name, email, message, ip_hash)
  values (btrim(p_name), lower(btrim(p_email)), btrim(p_message), p_ip_hash)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.ping() returns timestamptz
language sql stable
as $$ select now() $$;

-- Supabase grants execute on new functions to everyone by default; narrow it down.
revoke all on function public.submit_contact(text, text, text, text) from public, anon, authenticated;
revoke all on function public.ping() from public, anon, authenticated;
grant execute on function public.submit_contact(text, text, text, text) to anon;
grant execute on function public.ping() to anon;
