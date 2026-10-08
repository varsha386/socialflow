-- SocialFlow: inbox (comments on your published posts)
-- Run this in Supabase (project elcquybhujocfdvindsq): SQL Editor > New query > paste ALL > Run.
-- Safe to run more than once. It only adds things; nothing is deleted.

create table if not exists public.comments (
  id                    uuid primary key default gen_random_uuid(),
  target_id             uuid not null references public.post_targets (id) on delete cascade,
  platform_comment_id   text not null,               -- the comment's ID on the platform
  parent_comment_id     text,                        -- set for replies: the top-level comment's ID
  author_name           text,
  author_avatar_url     text,
  text                  text not null default '',
  is_own                boolean not null default false, -- written by your Page/account/channel
  created_at            timestamptz not null,
  synced_at             timestamptz not null default now(),
  unique (target_id, platform_comment_id)
);

create index if not exists comments_target_idx on public.comments (target_id, created_at desc);

-- When comments were last collected for this user (to limit the Refresh button).
alter table public.profiles
  add column if not exists inbox_synced_at timestamptz;

alter table public.comments enable row level security;

drop policy if exists "Users can view comments on their own posts" on public.comments;
create policy "Users can view comments on their own posts"
  on public.comments for select to authenticated
  using (
    exists (
      select 1
      from public.post_targets t
      join public.posts p on p.id = t.post_id
      where t.id = target_id and p.user_id = (select auth.uid())
    )
  );

-- Only the server (secret key) adds or changes comments.
revoke all on public.comments from anon;
revoke insert, update, delete on public.comments from authenticated;
grant select on public.comments to authenticated;
