-- "Why caching matters" demo — run once in Supabase: Dashboard → SQL Editor → paste → Run.
--
-- Design:
--   * demo_orders holds 100,000 generated orders. demo_top_products() runs a real report over
--     all of them on every call — Postgres has no result cache, so each call does the full work.
--   * demo_runs is the gate. Every click must pass demo_try_start(), which enforces, atomically:
--       - one run at a time, site-wide (keeps timings clean and the free database calm)
--       - 3 runs per visitor per hour, 10 per visitor per day
--       - 100 runs per day site-wide
--     A blocked start says exactly when the limit lifts (in seconds, as the error DETAIL),
--     so the page can lock its button with a countdown.
--     The gate lives here and not in Redis on purpose: Supabase API calls are unmetered, while the
--     free Redis plan counts every command. Blocked requests never touch Redis, so the demo's Redis
--     usage has a hard ceiling (100 runs × ~102 commands a day ≈ 310K a month, under the 500K free quota).
--   * Tables are locked down (RLS on, no policies, privileges revoked); only the three functions are callable.

create table if not exists public.demo_orders (
  id           bigint generated always as identity primary key,
  product_id   int           not null,
  customer_id  int           not null,
  quantity     int           not null,
  amount       numeric(10,2) not null,
  ordered_at   timestamptz   not null
);

-- Deterministic seed so every environment reports the same answer.
-- Product popularity is skewed, like real sales: low product ids sell far more.
select setseed(0.42);
with generated as materialized (
  select 1 + floor(power(random(), 2) * 500)::int                  as product_id,
         1 + floor(random() * 20000)::int                          as customer_id,
         1 + floor(random() * 4)::int                              as quantity,
         5 + random() * 95                                         as unit_price,
         timestamptz '2026-01-01' + random() * interval '270 days' as ordered_at
  from generate_series(1, 100000)
)
insert into public.demo_orders (product_id, customer_id, quantity, amount, ordered_at)
select product_id, customer_id, quantity, round((quantity * unit_price)::numeric, 2), ordered_at
from generated
where not exists (select 1 from public.demo_orders);

alter table public.demo_orders enable row level security;
revoke all on public.demo_orders from anon, authenticated;

create table if not exists public.demo_runs (
  id           bigint generated always as identity primary key,
  ip_hash      text        not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create index if not exists demo_runs_started_idx on public.demo_runs (started_at desc);
create index if not exists demo_runs_ip_idx on public.demo_runs (ip_hash, started_at desc);

alter table public.demo_runs enable row level security;
revoke all on public.demo_runs from anon, authenticated;

-- The "expensive" query: top 5 products by revenue across every order, with unique buyers.
create or replace function public.demo_top_products() returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_agg(t order by t.revenue desc)
  from (
    select product_id,
           count(*)                    as orders,
           count(distinct customer_id) as buyers,
           sum(amount)                 as revenue
    from demo_orders
    group by product_id
    order by revenue desc
    limit 5
  ) t
$$;

-- Returns the new run id, or raises daily_limit / visitor_limit / busy.
-- For the two limits, DETAIL holds the seconds until a run is allowed again.
create or replace function public.demo_try_start(p_ip_hash text) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id   bigint;
  frees_at timestamptz;
begin
  -- Every check below reads site-wide state, so starts are serialised with one global lock.
  perform pg_advisory_xact_lock(hashtext('demo_runs'));

  delete from demo_runs where started_at < now() - interval '2 days';

  -- Windows are rolling: with N runs allowed per window, a slot frees when the
  -- N-th most recent run in the window ages out of it.
  select started_at + interval '1 day' into frees_at
    from demo_runs where started_at > now() - interval '1 day'
    order by started_at desc offset 99 limit 1;
  if frees_at is not null then
    raise exception 'daily_limit' using detail = ceil(extract(epoch from frees_at - now()))::int::text;
  end if;

  select max(t) into frees_at from (
    (select started_at + interval '1 hour' as t from demo_runs
       where ip_hash = p_ip_hash and started_at > now() - interval '1 hour'
       order by started_at desc offset 2 limit 1)
    union all
    (select started_at + interval '1 day' from demo_runs
       where ip_hash = p_ip_hash and started_at > now() - interval '1 day'
       order by started_at desc offset 9 limit 1)
  ) as limits;
  if frees_at is not null then
    raise exception 'visitor_limit' using detail = ceil(extract(epoch from frees_at - now()))::int::text;
  end if;

  -- A run that never finished (crashed function) stops blocking others after 30 seconds.
  if exists (select 1 from demo_runs
               where finished_at is null and started_at > now() - interval '30 seconds') then
    raise exception 'busy';
  end if;

  insert into demo_runs (ip_hash) values (p_ip_hash) returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.demo_finish(p_run_id bigint) returns void
language sql
security definer
set search_path = public
as $$
  update demo_runs set finished_at = now() where id = p_run_id and finished_at is null
$$;

revoke all on function public.demo_top_products() from public, anon, authenticated;
revoke all on function public.demo_try_start(text) from public, anon, authenticated;
revoke all on function public.demo_finish(bigint) from public, anon, authenticated;
grant execute on function public.demo_top_products() to anon;
grant execute on function public.demo_try_start(text) to anon;
grant execute on function public.demo_finish(bigint) to anon;
