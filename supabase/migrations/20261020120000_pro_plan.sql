-- SocialFlow: Free and Pro plans
-- Run this in Supabase (project elcquybhujocfdvindsq): SQL Editor > New query > paste ALL > Run.
-- Safe to run more than once. Everyone starts on the Free plan; no other data is changed.
--
--   profiles.plan     'free' or 'pro'. Users can read it but never change it themselves:
--                     only the columns granted in 20261009000000_profile_column_permissions.sql
--                     and 20261019100000_email_alerts.sql are editable by them.
--   ai_caption_uses   one row each time someone uses the AI Caption Writer, to count the
--                     Free plan's monthly allowance. Only the server (secret key) adds rows.
--
-- To move someone to Pro (until payments are added), run:
--   update public.profiles set plan = 'pro'
--   where id = (select id from auth.users where email = 'person@example.com');
-- and to move them back, the same with 'free'.

alter table public.profiles
  add column if not exists plan text not null default 'free' check (plan in ('free', 'pro'));

create table if not exists public.ai_caption_uses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists ai_caption_uses_user_id_created_at_idx on public.ai_caption_uses (user_id, created_at);

alter table public.ai_caption_uses enable row level security;

drop policy if exists "Users can view their own AI caption uses" on public.ai_caption_uses;
create policy "Users can view their own AI caption uses"
  on public.ai_caption_uses for select to authenticated
  using (user_id = (select auth.uid()));

-- Same rule as every other table (see 20261009100000_require_two_step_login.sql).
drop policy if exists "Require two-step login" on public.ai_caption_uses;
create policy "Require two-step login" on public.ai_caption_uses as restrictive for all to authenticated
  using ((select public.two_step_satisfied()))
  with check ((select public.two_step_satisfied()));

-- Users can only read their own count; they can't add or remove rows to change it.
revoke all on public.ai_caption_uses from anon, authenticated;
grant select on public.ai_caption_uses to authenticated;
