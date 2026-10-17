-- SocialFlow: link-in-bio page
-- Run this in Supabase (project elcquybhujocfdvindsq): SQL Editor > New query > paste ALL > Run.
-- Safe to run more than once. Only adds new tables; no existing data is changed.
--
--   bio_pages  one public page per user, at /u/<handle>
--   bio_links  the link buttons on it, in order
--
-- Visitors never read these tables directly: the public page is loaded on the
-- server, and only when the owner has published it.

create table if not exists public.bio_pages (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  handle      text not null unique check (handle ~ '^[a-z0-9_]{3,30}$'),
  title       text not null default '' check (char_length(title) <= 60),
  bio         text not null default '' check (char_length(bio) <= 160),
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists bio_pages_updated_at on public.bio_pages;
create trigger bio_pages_updated_at
  before update on public.bio_pages
  for each row execute function public.set_updated_at();

create table if not exists public.bio_links (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 60),
  url         text not null check (url ~* '^https?://' and char_length(url) <= 2000),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists bio_links_user_id_position_idx on public.bio_links (user_id, position);

alter table public.bio_pages enable row level security;
alter table public.bio_links enable row level security;

drop policy if exists "Users manage their own bio page" on public.bio_pages;
create policy "Users manage their own bio page"
  on public.bio_pages for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage their own bio links" on public.bio_links;
create policy "Users manage their own bio links"
  on public.bio_links for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Same rule as every other table (see 20261009100000_require_two_step_login.sql).
drop policy if exists "Require two-step login" on public.bio_pages;
create policy "Require two-step login" on public.bio_pages as restrictive for all to authenticated
  using ((select public.two_step_satisfied()))
  with check ((select public.two_step_satisfied()));

drop policy if exists "Require two-step login" on public.bio_links;
create policy "Require two-step login" on public.bio_links as restrictive for all to authenticated
  using ((select public.two_step_satisfied()))
  with check ((select public.two_step_satisfied()));

revoke all on public.bio_pages, public.bio_links from anon;
grant select, insert, update, delete on public.bio_pages, public.bio_links to authenticated;
