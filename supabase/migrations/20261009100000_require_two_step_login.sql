-- SocialFlow: enforce two-step login in the database
-- Run this in Supabase (project elcquybhujocfdvindsq): SQL Editor > New query > paste ALL > Run.
-- Safe to run more than once. No data is changed or deleted.
--
-- If a user has turned on two-step login, their data can only be read or changed
-- by a session that has also passed the 6-digit code (Supabase calls this "aal2").
-- So a stolen password alone can't be used to read their data through the API.
-- Users without two-step login aren't affected. The server's secret key isn't affected.

-- True when the current session is allowed in: either the user has no verified
-- two-step factor, or this session already passed it.
create or replace function public.two_step_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;

revoke all on function public.two_step_satisfied() from public, anon;
grant execute on function public.two_step_satisfied() to authenticated;

-- A "restrictive" policy must pass IN ADDITION to the existing ownership policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'social_accounts', 'media', 'posts', 'post_media',
    'post_targets', 'post_metrics', 'account_metrics', 'comments'
  ]
  loop
    execute format('drop policy if exists "Require two-step login" on public.%I', t);
    execute format(
      'create policy "Require two-step login" on public.%I as restrictive for all to authenticated
         using ((select public.two_step_satisfied()))
         with check ((select public.two_step_satisfied()))',
      t
    );
  end loop;
end $$;

-- Uploads and file access in storage too.
drop policy if exists "Require two-step login" on storage.objects;
create policy "Require two-step login" on storage.objects as restrictive for all to authenticated
  using ((select public.two_step_satisfied()))
  with check ((select public.two_step_satisfied()));
