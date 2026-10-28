-- SocialFlow: allow 500 MB uploads
-- ⚠️ Run this ONLY after the project is on Supabase Pro. The free plan caps every file
-- at 50 MB, and raising the bucket above the project's limit is refused.
--
-- Steps on Supabase Pro:
--   1. Supabase dashboard > Storage > Settings: set the global upload limit to at least 500 MB.
--   2. Run this file in the SQL Editor (project elcquybhujocfdvindsq). Safe to run more than once.
--   3. Set NEXT_PUBLIC_MAX_VIDEO_MB=500 in .env.local and on Vercel, then redeploy.

update storage.buckets
set file_size_limit = 524288000  -- 500 MB
where id = 'media';
