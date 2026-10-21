-- SocialFlow: email alert settings
-- Run this in Supabase (project elcquybhujocfdvindsq): SQL Editor > New query > paste ALL > Run.
-- Safe to run more than once. Adds three columns to profiles; existing data is unchanged.
--
-- Which emails each user wants:
--   email_on_failed     a scheduled post failed on one or more accounts   (on by default)
--   email_on_reconnect  an account stopped working and needs reconnecting (on by default)
--   email_on_published  a scheduled post went out                         (off by default)

alter table public.profiles
  add column if not exists email_on_failed    boolean not null default true,
  add column if not exists email_on_reconnect boolean not null default true,
  add column if not exists email_on_published boolean not null default false;

-- Users may change these themselves, along with the fields they could already change
-- (see 20261009000000_profile_column_permissions.sql). Nothing else becomes editable.
grant update (email_on_failed, email_on_reconnect, email_on_published) on public.profiles to authenticated;
