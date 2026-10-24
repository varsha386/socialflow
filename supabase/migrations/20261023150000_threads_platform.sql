-- SocialFlow: allow Threads accounts
-- Run this in Supabase (project elcquybhujocfdvindsq): SQL Editor > New query > paste ALL > Run.
-- Safe to run more than once. Adds 'threads' to the list of platforms; no data is changed.

alter type public.platform add value if not exists 'threads';
