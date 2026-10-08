-- SocialFlow: limit which profile fields users can change themselves
-- Run this in Supabase (project elcquybhujocfdvindsq): SQL Editor > New query > paste ALL > Run.
-- Safe to run more than once. No data is changed or deleted.
--
-- Before: logged-in users could update ANY column of their own profile, including
-- metrics_refreshed_at and inbox_synced_at, which SocialFlow uses to limit how often
-- "Refresh now" can run. Resetting them would skip those limits.
-- After: users can only change their name, picture and time zone. The cooldown
-- columns can only be changed by the server (secret key).

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, timezone) on public.profiles to authenticated;
