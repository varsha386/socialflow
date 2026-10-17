-- SocialFlow: posting queue
-- Run this in Supabase (project elcquybhujocfdvindsq): SQL Editor > New query > paste ALL > Run.
-- Safe to run more than once. Only adds a new table; no existing data is changed.
--
--   queue_slots  the weekly times a user likes to post (e.g. Monday 09:00), in their
--                profile's time zone. "Add to queue" schedules a post at the next one
--                that doesn't already have a post.

create table if not exists public.queue_slots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 7),  -- 1 = Monday ... 7 = Sunday
  time        time not null,                                      -- wall-clock time in the user's time zone
  created_at  timestamptz not null default now(),
  unique (user_id, weekday, time)
);

create index if not exists queue_slots_user_id_idx on public.queue_slots (user_id);

alter table public.queue_slots enable row level security;

drop policy if exists "Users manage their own queue slots" on public.queue_slots;
create policy "Users manage their own queue slots"
  on public.queue_slots for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Same rule as every other table (see 20261009100000_require_two_step_login.sql).
drop policy if exists "Require two-step login" on public.queue_slots;
create policy "Require two-step login" on public.queue_slots as restrictive for all to authenticated
  using ((select public.two_step_satisfied()))
  with check ((select public.two_step_satisfied()));

revoke all on public.queue_slots from anon;
grant select, insert, delete on public.queue_slots to authenticated;
