-- SocialFlow: analytics tables
-- Run this in Supabase: SQL Editor > New query > paste > Run. Safe to run more than once.
--
--   post_metrics     the latest numbers for each published post on each account
--   account_metrics  one follower count per account per day (for growth over time)
--
-- Only the server (secret key) writes these; users can read their own rows.

create table if not exists public.post_metrics (
  target_id   uuid primary key references public.post_targets (id) on delete cascade,
  views       bigint,   -- null = the platform doesn't share this number
  likes       bigint,
  comments    bigint,
  shares      bigint,
  fetched_at  timestamptz not null default now()
);

create table if not exists public.account_metrics (
  account_id  uuid not null references public.social_accounts (id) on delete cascade,
  day         date not null,
  followers   bigint,
  fetched_at  timestamptz not null default now(),
  primary key (account_id, day)
);

-- When the user last pressed "Refresh now" (to limit how often it can run).
alter table public.profiles
  add column if not exists metrics_refreshed_at timestamptz;

alter table public.post_metrics enable row level security;
alter table public.account_metrics enable row level security;

drop policy if exists "Users can view metrics of their own posts" on public.post_metrics;
create policy "Users can view metrics of their own posts"
  on public.post_metrics for select to authenticated
  using (
    exists (
      select 1
      from public.post_targets t
      join public.posts p on p.id = t.post_id
      where t.id = target_id and p.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can view metrics of their own accounts" on public.account_metrics;
create policy "Users can view metrics of their own accounts"
  on public.account_metrics for select to authenticated
  using (
    exists (
      select 1 from public.social_accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
  );

revoke all on public.post_metrics, public.account_metrics from anon;
revoke insert, update, delete on public.post_metrics, public.account_metrics from authenticated;
grant select on public.post_metrics, public.account_metrics to authenticated;
