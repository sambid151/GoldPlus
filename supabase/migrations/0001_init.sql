-- GoldPulse schema.
-- rate_snapshots: append-only, written only when a karat's price changes.
-- daily_closes:   one row per (karat, IST date); latest value of the day wins.
-- ingest_state:   single row tracking source health for the "stale" badge/backoff.

create table if not exists public.rate_snapshots (
  id            bigint generated always as identity primary key,
  karat         text        not null check (karat in ('24K','22K','18K')),
  price_per_gram numeric(12,2) not null check (price_per_gram > 0),
  rate_date     date        not null,
  fetched_at    timestamptz not null,
  source        text        not null
);
create index if not exists rate_snapshots_karat_fetched_idx
  on public.rate_snapshots (karat, fetched_at desc);

create table if not exists public.daily_closes (
  karat         text        not null check (karat in ('24K','22K','18K')),
  rate_date     date        not null,
  price_per_gram numeric(12,2) not null check (price_per_gram > 0),
  source        text        not null,
  primary key (karat, rate_date)
);
create index if not exists daily_closes_date_idx on public.daily_closes (rate_date desc);

create table if not exists public.ingest_state (
  id                    smallint primary key default 1 check (id = 1),
  last_success_at       timestamptz,
  last_attempt_at       timestamptz,
  consecutive_failures  integer     not null default 0,
  last_error            text,
  next_retry_at         timestamptz
);
insert into public.ingest_state (id) values (1) on conflict do nothing;

-- Server-side access only (service role bypasses RLS). No public policies.
alter table public.rate_snapshots enable row level security;
alter table public.daily_closes   enable row level security;
alter table public.ingest_state   enable row level security;
