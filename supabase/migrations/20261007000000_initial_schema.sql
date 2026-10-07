-- SocialFlow: initial database schema
-- Run this in Supabase: SQL Editor > New query > paste > Run.
-- WARNING: it first DELETES any existing SocialFlow tables and their rows
-- (see "Clean up" below), so only run it again if you want to start fresh.
--
-- Tables:
--   profiles               one row per user (name, photo, time zone)
--   social_accounts        connected Bluesky/LinkedIn/YouTube/Facebook/Instagram accounts
--   social_account_tokens  login tokens for those accounts (server-only, never sent to browsers)
--   media                  uploaded images and videos
--   posts                  a post: caption, status, when to publish
--   post_media             which media belongs to which post, in order
--   post_targets           where a post goes (one row per account), with its own caption and result
--
-- Row Level Security (RLS) is on for every table, so each user can only
-- read and change their own rows.

begin;

-- ---------------------------------------------------------------------------
-- Clean up: remove an older, different set of tables that existed in this
-- project before. Login accounts (auth.users) and uploaded files are NOT touched.
-- ---------------------------------------------------------------------------

-- Old sign-up triggers on auth.users that call our functions would break
-- sign-up once their tables are gone, so remove them.
do $$
declare
  t record;
begin
  for t in
    select tg.tgname
    from pg_trigger tg
    join pg_proc p on p.oid = tg.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where tg.tgrelid = 'auth.users'::regclass
      and not tg.tgisinternal
      and n.nspname = 'public'
  loop
    execute format('drop trigger %I on auth.users', t.tgname);
  end loop;
end $$;

-- Old storage rules for the "media" bucket (new ones are created below).
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (coalesce(qual, '') ilike '%''media''%' or coalesce(with_check, '') ilike '%''media''%')
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

drop table if exists
  public.post_media,
  public.post_targets,
  public.media,
  public.posts,
  public.social_account_tokens,
  public.social_accounts,
  public.profiles
  cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;
drop type if exists public.platform, public.post_status, public.target_status cascade;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.platform as enum ('bluesky', 'linkedin', 'youtube', 'facebook', 'instagram');

create type public.post_status as enum (
  'draft',                -- still being written
  'scheduled',            -- waiting for scheduled_at
  'publishing',           -- being sent right now
  'published',            -- every target succeeded
  'partially_published',  -- some targets failed
  'failed'                -- every target failed
);

create type public.target_status as enum ('pending', 'publishing', 'published', 'failed');

-- Keeps updated_at current on every UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  timezone    text not null default 'UTC',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when someone signs up (email or Google).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles for people who signed up before this table existed.
insert into public.profiles (id, full_name, avatar_url)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
  raw_user_meta_data ->> 'avatar_url'
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- social_accounts + social_account_tokens
-- ---------------------------------------------------------------------------

create table public.social_accounts (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform             public.platform not null,
  platform_account_id  text not null,            -- the account's ID on that platform
  display_name         text,
  username             text,
  avatar_url           text,
  status               text not null default 'connected'
                         check (status in ('connected', 'expired', 'error')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, platform, platform_account_id)
);

create index social_accounts_user_id_idx on public.social_accounts (user_id);

create trigger social_accounts_updated_at
  before update on public.social_accounts
  for each row execute function public.set_updated_at();

-- Tokens live in their own table with NO access policies, so browsers can
-- never read them. Only server code using the secret key can.
create table public.social_account_tokens (
  account_id     uuid primary key references public.social_accounts (id) on delete cascade,
  access_token   text not null,
  refresh_token  text,
  expires_at     timestamptz,
  updated_at     timestamptz not null default now()
);

create trigger social_account_tokens_updated_at
  before update on public.social_account_tokens
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- media
-- ---------------------------------------------------------------------------

create table public.media (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  storage_path      text not null unique,        -- path inside the "media" storage bucket
  mime_type         text not null,
  size_bytes        bigint not null check (size_bytes > 0),
  width             integer,
  height            integer,
  duration_seconds  numeric,
  created_at        timestamptz not null default now()
);

create index media_user_id_idx on public.media (user_id);

-- ---------------------------------------------------------------------------
-- posts, post_media, post_targets
-- ---------------------------------------------------------------------------

create table public.posts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  caption       text not null default '',
  status        public.post_status not null default 'draft',
  scheduled_at  timestamptz,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint scheduled_posts_need_a_time
    check (status <> 'scheduled' or scheduled_at is not null)
);

create index posts_user_id_status_idx on public.posts (user_id, status);
create index posts_due_idx on public.posts (scheduled_at) where status = 'scheduled';

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create table public.post_media (
  post_id   uuid not null references public.posts (id) on delete cascade,
  media_id  uuid not null references public.media (id) on delete cascade,
  position  integer not null default 0,
  primary key (post_id, media_id)
);

create index post_media_media_id_idx on public.post_media (media_id);

create table public.post_targets (
  id                 uuid primary key default gen_random_uuid(),
  post_id            uuid not null references public.posts (id) on delete cascade,
  social_account_id  uuid not null references public.social_accounts (id) on delete cascade,
  custom_caption     text,                       -- null = use the post's main caption
  status             public.target_status not null default 'pending',
  external_post_id   text,                       -- the post's ID on the platform, once published
  external_url       text,
  error_message      text,
  published_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (post_id, social_account_id)
);

create index post_targets_account_idx on public.post_targets (social_account_id);
create index post_targets_published_idx on public.post_targets (published_at) where status = 'published';

create trigger post_targets_updated_at
  before update on public.post_targets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles              enable row level security;
alter table public.social_accounts       enable row level security;
alter table public.social_account_tokens enable row level security;
alter table public.media                 enable row level security;
alter table public.posts                 enable row level security;
alter table public.post_media            enable row level security;
alter table public.post_targets          enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Users manage their own social accounts"
  on public.social_accounts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users manage their own media"
  on public.media for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users manage their own posts"
  on public.posts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- A post can only use media and accounts that belong to the same user.
create policy "Users manage media on their own posts"
  on public.post_media for all to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid()))
    and exists (select 1 from public.media m where m.id = media_id and m.user_id = (select auth.uid()))
  );

create policy "Users manage targets on their own posts"
  on public.post_targets for all to authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid()))
    and exists (
      select 1 from public.social_accounts a
      where a.id = social_account_id and a.user_id = (select auth.uid())
    )
  );

-- social_account_tokens: no policies on purpose (server-only).

-- Logged-out visitors get no access at all; logged-in users go through RLS.
revoke all on public.profiles, public.social_accounts, public.social_account_tokens,
  public.media, public.posts, public.post_media, public.post_targets from anon;
revoke all on public.social_account_tokens from authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.social_accounts, public.media, public.posts,
  public.post_media, public.post_targets to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: "media" bucket for uploads
-- ---------------------------------------------------------------------------
-- Public so platforms like Instagram can download the files when publishing.
-- Files go in a folder named after the user's ID: <user-id>/<file-name>.
-- 50 MB per file (the free-plan maximum).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload to their own media folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can view their own media folder"
  on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can update their own media"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users can delete their own media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
