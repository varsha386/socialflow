-- SocialFlow: per-platform options on post targets
-- Run this in Supabase: SQL Editor > New query > paste > Run. Safe to run more than once.
--
-- Some platforms need extra settings besides the caption, for example a YouTube
-- video needs a title and a privacy setting. They're stored as JSON, e.g.
--   {"title": "My video", "privacy": "public"}

alter table public.post_targets
  add column if not exists options jsonb not null default '{}'::jsonb;
