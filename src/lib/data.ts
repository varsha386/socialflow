// Functions that read from the database on the server.
// Row Level Security makes sure each query only sees the logged-in user's rows.

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/media";
import type { PlatformId } from "@/lib/platforms";
import type { MediaItem, YouTubeOptions } from "@/lib/post-rules";
import { utcToZonedInput } from "@/lib/timezone";
import type { PostStatus, Profile, SocialAccount } from "@/lib/types";

// The logged-in user and their profile. `cache` means the layout and the
// page can both call this during one request but Supabase is only asked once.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, timezone")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  const email = user.email ?? "";
  const name =
    profile?.full_name ||
    (user.user_metadata.full_name as string | undefined) ||
    email.split("@")[0];

  return {
    id: user.id,
    email,
    name,
    timezone: profile?.timezone ?? "UTC",
  };
});

export async function getSocialAccounts(): Promise<SocialAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_accounts")
    .select("id, platform, platform_account_id, display_name, username, avatar_url, status")
    .order("created_at");
  if (error) throw new Error(`Couldn't load social accounts: ${error.message}`);
  return data as SocialAccount[];
}

export async function getDashboardStats() {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // `head: true` asks only for the count, not the rows themselves.
  const [scheduled, published, accounts, posts] = await Promise.all([
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
    supabase
      .from("post_targets")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .gte("published_at", weekAgo),
    supabase
      .from("social_accounts")
      .select("id", { count: "exact", head: true })
      .eq("status", "connected"),
    supabase.from("posts").select("id", { count: "exact", head: true }),
  ]);

  const failed = [scheduled, published, accounts, posts].find((r) => r.error);
  if (failed?.error) throw new Error(`Couldn't load dashboard: ${failed.error.message}`);

  return {
    scheduledPosts: scheduled.count ?? 0,
    publishedThisWeek: published.count ?? 0,
    connectedAccounts: accounts.count ?? 0,
    totalPosts: posts.count ?? 0,
  };
}

// Everything the Create post screen needs to reopen a saved draft.
export async function getDraft(postId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      `id, caption, status,
       post_media ( position, media ( id, storage_path, mime_type, size_bytes, width, height, duration_seconds ) ),
       post_targets ( social_account_id, custom_caption, options, social_accounts ( platform ) )`
    )
    .eq("id", postId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the post: ${error.message}`);
  if (!data) return null;

  type MediaRow = {
    id: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    width: number | null;
    height: number | null;
    duration_seconds: number | null;
  };
  type Row = {
    id: string;
    caption: string;
    status: PostStatus;
    post_media: { position: number; media: MediaRow | null }[];
    post_targets: {
      social_account_id: string;
      custom_caption: string | null;
      options: Record<string, unknown>;
      social_accounts: { platform: PlatformId } | null;
    }[];
  };
  const post = data as unknown as Row;

  const media: MediaItem[] = post.post_media
    .filter((pm) => pm.media)
    .sort((a, b) => a.position - b.position)
    .map(({ media: m }) => ({
      id: m!.id,
      url: mediaUrl(m!.storage_path),
      storagePath: m!.storage_path,
      mimeType: m!.mime_type,
      kind: m!.mime_type.startsWith("video/") ? "video" : "image",
      sizeBytes: m!.size_bytes,
      width: m!.width,
      height: m!.height,
      durationSeconds: m!.duration_seconds,
    }));

  // Custom captions and YouTube options are stored per account; the screen works per platform.
  const customCaptions: Partial<Record<PlatformId, string>> = {};
  let youtube: YouTubeOptions = { title: "", privacy: "public" };
  for (const t of post.post_targets) {
    const platform = t.social_accounts?.platform;
    if (!platform) continue;
    if (t.custom_caption !== null) customCaptions[platform] = t.custom_caption;
    if (platform === "youtube") {
      youtube = {
        title: String(t.options.title ?? ""),
        privacy: (t.options.privacy as YouTubeOptions["privacy"]) ?? "public",
      };
    }
  }

  return {
    id: post.id,
    status: post.status,
    caption: post.caption,
    media,
    accountIds: post.post_targets.map((t) => t.social_account_id),
    customCaptions,
    youtube,
  };
}

export type Draft = NonNullable<Awaited<ReturnType<typeof getDraft>>>;

export type PostListItem = {
  id: string;
  caption: string;
  status: PostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  platforms: PlatformId[];
  thumbnail: { url: string; kind: "image" | "video" } | null;
  mediaCount: number;
};

// All of the user's posts, newest first, for the Posts page.
export async function getPosts(): Promise<PostListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      `id, caption, status, scheduled_at, published_at, updated_at,
       post_media ( position, media ( storage_path, mime_type ) ),
       post_targets ( social_accounts ( platform ) )`
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Couldn't load posts: ${error.message}`);

  type Row = {
    id: string;
    caption: string;
    status: PostStatus;
    scheduled_at: string | null;
    published_at: string | null;
    updated_at: string;
    post_media: { position: number; media: { storage_path: string; mime_type: string } | null }[];
    post_targets: { social_accounts: { platform: PlatformId } | null }[];
  };

  return (data as unknown as Row[]).map((p) => {
    const first = [...p.post_media].sort((a, b) => a.position - b.position)[0]?.media;
    const platforms = new Set(p.post_targets.map((t) => t.social_accounts?.platform).filter(Boolean));
    return {
      id: p.id,
      caption: p.caption,
      status: p.status,
      scheduledAt: p.scheduled_at,
      publishedAt: p.published_at,
      updatedAt: p.updated_at,
      platforms: [...platforms] as PlatformId[],
      thumbnail: first
        ? { url: mediaUrl(first.storage_path), kind: first.mime_type.startsWith("video/") ? "video" : "image" }
        : null,
      mediaCount: p.post_media.length,
    };
  });
}

export type PostTargetDetail = {
  id: string;
  status: "pending" | "publishing" | "published" | "failed";
  platform: PlatformId;
  accountName: string;
  accountAvatar: string | null;
  url: string | null;
  error: string | null;
  publishedAt: string | null;
};

// One post with each account's result, for the post details page.
export async function getPostDetail(postId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(
      `id, caption, status, scheduled_at, published_at, updated_at,
       post_media ( position, media ( storage_path, mime_type ) ),
       post_targets ( id, status, external_url, error_message, published_at,
         social_accounts ( platform, display_name, username, avatar_url ) )`
    )
    .eq("id", postId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the post: ${error.message}`);
  if (!data) return null;

  type Row = {
    id: string;
    caption: string;
    status: PostStatus;
    scheduled_at: string | null;
    published_at: string | null;
    updated_at: string;
    post_media: { position: number; media: { storage_path: string; mime_type: string } | null }[];
    post_targets: {
      id: string;
      status: PostTargetDetail["status"];
      external_url: string | null;
      error_message: string | null;
      published_at: string | null;
      social_accounts: {
        platform: PlatformId;
        display_name: string | null;
        username: string | null;
        avatar_url: string | null;
      } | null;
    }[];
  };
  const p = data as unknown as Row;

  return {
    id: p.id,
    caption: p.caption,
    status: p.status,
    scheduledAt: p.scheduled_at,
    publishedAt: p.published_at,
    updatedAt: p.updated_at,
    media: [...p.post_media]
      .sort((a, b) => a.position - b.position)
      .filter((pm) => pm.media)
      .map((pm) => ({
        url: mediaUrl(pm.media!.storage_path),
        kind: pm.media!.mime_type.startsWith("video/") ? ("video" as const) : ("image" as const),
      })),
    targets: p.post_targets
      .filter((t) => t.social_accounts)
      .map(
        (t): PostTargetDetail => ({
          id: t.id,
          status: t.status,
          platform: t.social_accounts!.platform,
          accountName: t.social_accounts!.display_name ?? t.social_accounts!.username ?? "",
          accountAvatar: t.social_accounts!.avatar_url,
          url: t.external_url,
          error: t.error_message,
          publishedAt: t.published_at,
        })
      ),
  };
}

export type CalendarPost = {
  id: string;
  status: PostStatus;
  caption: string;
  platforms: PlatformId[];
  at: string; // ISO time it goes out (scheduled) or went out (published)
  localDate: string; // "YYYY-MM-DD" in the user's time zone
  localTime: string; // "HH:mm" in the user's time zone
};

// Scheduled and published posts between two moments, placed on the user's calendar days.
export async function getCalendarPosts(fromIso: string, toIso: string, timeZone: string): Promise<CalendarPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("id, status, caption, scheduled_at, published_at, post_targets ( social_accounts ( platform ) )")
    .neq("status", "draft")
    .or(
      `and(scheduled_at.gte.${fromIso},scheduled_at.lt.${toIso}),and(published_at.gte.${fromIso},published_at.lt.${toIso})`
    )
    .limit(500);
  if (error) throw new Error(`Couldn't load the calendar: ${error.message}`);

  type Row = {
    id: string;
    status: PostStatus;
    caption: string;
    scheduled_at: string | null;
    published_at: string | null;
    post_targets: { social_accounts: { platform: PlatformId } | null }[];
  };

  return (data as unknown as Row[])
    .map((p) => {
      const waiting = p.status === "scheduled" || p.status === "publishing";
      const at = (waiting ? p.scheduled_at : p.published_at ?? p.scheduled_at)!;
      const local = utcToZonedInput(new Date(at), timeZone);
      const platforms = new Set(p.post_targets.map((t) => t.social_accounts?.platform).filter(Boolean));
      return {
        id: p.id,
        status: p.status,
        caption: p.caption,
        platforms: [...platforms] as PlatformId[],
        at,
        localDate: local.slice(0, 10),
        localTime: local.slice(11, 16),
      };
    })
    // Compare as real times: Supabase writes "+00:00" where JavaScript writes "Z".
    .filter((p) => Date.parse(p.at) >= Date.parse(fromIso) && Date.parse(p.at) < Date.parse(toIso))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export type AnalyticsData = {
  totals: { views: number; likes: number; comments: number; shares: number; posts: number };
  hasViews: boolean;
  days: { date: string; likes: number; comments: number; shares: number }[]; // last 30 days, oldest first
  accounts: { id: string; platform: PlatformId; name: string; followers: number | null; change: number | null }[];
  topPosts: {
    postId: string;
    caption: string;
    platform: PlatformId;
    accountName: string;
    url: string | null;
    views: number | null;
    likes: number;
    comments: number;
    shares: number;
  }[];
  lastRefreshed: string | null;
};

// Everything the Analytics page shows, for posts published in the last 30 days.
export async function getAnalytics(timeZone: string): Promise<AnalyticsData> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [targetsRes, accountsRes, followersRes, profileRes] = await Promise.all([
    supabase
      .from("post_targets")
      .select(
        `id, post_id, published_at, external_url,
         social_accounts ( platform, display_name, username ),
         posts ( caption ),
         post_metrics ( views, likes, comments, shares )`
      )
      .eq("status", "published")
      .gte("published_at", since),
    supabase.from("social_accounts").select("id, platform, display_name, username").eq("status", "connected"),
    supabase
      .from("account_metrics")
      .select("account_id, day, followers")
      .gte("day", since.slice(0, 10))
      .order("day"),
    supabase.from("profiles").select("metrics_refreshed_at").maybeSingle(),
  ]);
  for (const res of [targetsRes, accountsRes, followersRes]) {
    if (res.error) throw new Error(`Couldn't load analytics: ${res.error.message}`);
  }

  type MetricRow = { views: number | null; likes: number | null; comments: number | null; shares: number | null };
  type TargetRow = {
    id: string;
    post_id: string;
    published_at: string;
    external_url: string | null;
    social_accounts: { platform: PlatformId; display_name: string | null; username: string | null } | null;
    posts: { caption: string } | null;
    post_metrics: MetricRow | MetricRow[] | null;
  };

  const totals = { views: 0, likes: 0, comments: 0, shares: 0, posts: 0 };
  let hasViews = false;
  const byDay = new Map<string, { likes: number; comments: number; shares: number }>();
  const topPosts: AnalyticsData["topPosts"] = [];

  for (const t of (targetsRes.data ?? []) as unknown as TargetRow[]) {
    const m = Array.isArray(t.post_metrics) ? t.post_metrics[0] : t.post_metrics;
    const likes = Number(m?.likes ?? 0);
    const comments = Number(m?.comments ?? 0);
    const shares = Number(m?.shares ?? 0);
    totals.likes += likes;
    totals.comments += comments;
    totals.shares += shares;
    totals.posts += 1;
    if (m?.views !== null && m?.views !== undefined) {
      totals.views += Number(m.views);
      hasViews = true;
    }

    const day = utcToZonedInput(new Date(t.published_at), timeZone).slice(0, 10);
    const bucket = byDay.get(day) ?? { likes: 0, comments: 0, shares: 0 };
    bucket.likes += likes;
    bucket.comments += comments;
    bucket.shares += shares;
    byDay.set(day, bucket);

    topPosts.push({
      postId: t.post_id,
      caption: t.posts?.caption ?? "",
      platform: t.social_accounts?.platform ?? "facebook",
      accountName: t.social_accounts?.display_name ?? t.social_accounts?.username ?? "",
      url: t.external_url,
      views: m?.views ?? null,
      likes,
      comments,
      shares,
    });
  }

  // The last 30 calendar days in the user's time zone, oldest first, including empty days.
  const today = utcToZonedInput(new Date(), timeZone).slice(0, 10);
  const days: AnalyticsData["days"] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.parse(`${today}T00:00:00Z`) - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    days.push({ date, ...(byDay.get(date) ?? { likes: 0, comments: 0, shares: 0 }) });
  }

  // Followers: the latest count, and the change since the first count in the window.
  type FollowerRow = { account_id: string; day: string; followers: number | null };
  const followerRows = (followersRes.data ?? []) as FollowerRow[];
  const accounts = ((accountsRes.data ?? []) as { id: string; platform: PlatformId; display_name: string | null; username: string | null }[]).map((a) => {
    const rows = followerRows.filter((r) => r.account_id === a.id && r.followers !== null);
    const first = rows[0]?.followers ?? null;
    const last = rows.at(-1)?.followers ?? null;
    return {
      id: a.id,
      platform: a.platform,
      name: a.display_name ?? a.username ?? "",
      followers: last === null ? null : Number(last),
      change: first === null || last === null || rows.length < 2 ? null : Number(last) - Number(first),
    };
  });

  topPosts.sort((a, b) => b.likes + b.comments + b.shares - (a.likes + a.comments + a.shares));

  return {
    totals,
    hasViews,
    days,
    accounts,
    topPosts: topPosts.slice(0, 5),
    lastRefreshed: (profileRes.data?.metrics_refreshed_at as string | null) ?? null,
  };
}

export type InboxComment = {
  id: string;
  author: string | null;
  avatarUrl: string | null;
  text: string;
  isOwn: boolean;
  createdAt: string;
};

export type InboxThread = InboxComment & {
  platform: PlatformId;
  accountName: string;
  postId: string;
  postCaption: string;
  postUrl: string | null;
  replies: InboxComment[];
  needsReply: boolean;
};

// Comment threads on the user's posts, newest first. A thread "needs a reply" when
// someone else wrote it and your account hasn't replied in it yet.
export async function getInbox(): Promise<{ threads: InboxThread[]; lastSynced: string | null }> {
  const supabase = await createClient();
  const [commentsRes, profileRes] = await Promise.all([
    supabase
      .from("comments")
      .select(
        `id, platform_comment_id, parent_comment_id, author_name, author_avatar_url, text, is_own, created_at,
         post_targets ( post_id, external_url, social_accounts ( platform, display_name, username ), posts ( caption ) )`
      )
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("profiles").select("inbox_synced_at").maybeSingle(),
  ]);
  if (commentsRes.error) throw new Error(`Couldn't load the inbox: ${commentsRes.error.message}`);

  type Row = {
    id: string;
    platform_comment_id: string;
    parent_comment_id: string | null;
    author_name: string | null;
    author_avatar_url: string | null;
    text: string;
    is_own: boolean;
    created_at: string;
    post_targets: {
      post_id: string;
      external_url: string | null;
      social_accounts: { platform: PlatformId; display_name: string | null; username: string | null } | null;
      posts: { caption: string } | null;
    } | null;
  };
  const rows = (commentsRes.data ?? []) as unknown as Row[];
  const toComment = (r: Row): InboxComment => ({
    id: r.id,
    author: r.author_name,
    avatarUrl: r.author_avatar_url,
    text: r.text,
    isOwn: r.is_own,
    createdAt: r.created_at,
  });

  // Replies grouped under their top-level comment, oldest reply first.
  const repliesByParent = new Map<string, InboxComment[]>();
  for (const r of rows) {
    if (!r.parent_comment_id) continue;
    const list = repliesByParent.get(r.parent_comment_id) ?? [];
    list.unshift(toComment(r));
    repliesByParent.set(r.parent_comment_id, list);
  }

  const threads: InboxThread[] = rows
    .filter((r) => !r.parent_comment_id && r.post_targets)
    .map((r) => {
      const replies = repliesByParent.get(r.platform_comment_id) ?? [];
      const account = r.post_targets!.social_accounts;
      return {
        ...toComment(r),
        platform: account?.platform ?? "facebook",
        accountName: account?.display_name ?? account?.username ?? "",
        postId: r.post_targets!.post_id,
        postCaption: r.post_targets!.posts?.caption ?? "",
        postUrl: r.post_targets!.external_url,
        replies,
        needsReply: !r.is_own && !replies.some((x) => x.isOwn),
      };
    });

  return { threads, lastSynced: (profileRes.data?.inbox_synced_at as string | null) ?? null };
}
