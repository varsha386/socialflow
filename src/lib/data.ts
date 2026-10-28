// Functions that read from the database on the server.
// Row Level Security makes sure each query only sees the logged-in user's rows.

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/media";
import type { PlatformId } from "@/lib/platforms";
import {
  DEFAULT_FACEBOOK,
  DEFAULT_INSTAGRAM,
  DEFAULT_PINTEREST,
  type FacebookOptions,
  type InstagramOptions,
  type MediaItem,
  type PinterestOptions,
  type YouTubeOptions,
} from "@/lib/post-rules";
import { engagementScore, rankBestTimes, type BestTimes } from "@/lib/best-time";
import type { BioLink, BioPage } from "@/lib/bio";
import { createAdminClient } from "@/lib/supabase/admin";
import { QUEUE_HORIZON_DAYS, minuteOf, upcomingSlotTimes, type QueueSlot } from "@/lib/queue";
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

// The caption to show for a post: its main caption, or, if it only has captions
// typed on a platform's tab (e.g. just "Facebook"), the first of those.
function displayCaption(caption: string, targets: { custom_caption: string | null }[]) {
  if (caption.trim()) return caption;
  return targets.find((t) => t.custom_caption?.trim())?.custom_caption ?? "";
}

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

// Everything the Create post screen needs to reopen a saved draft,
// or to copy any earlier post for "Post again".
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

  // Custom captions and YouTube/Instagram options are stored per account; the screen works per platform.
  const customCaptions: Partial<Record<PlatformId, string>> = {};
  let youtube: YouTubeOptions = { title: "", privacy: "public" };
  let instagram: InstagramOptions = DEFAULT_INSTAGRAM;
  let facebook: FacebookOptions = DEFAULT_FACEBOOK;
  let pinterest: PinterestOptions = DEFAULT_PINTEREST;
  for (const t of post.post_targets) {
    const platform = t.social_accounts?.platform;
    if (!platform) continue;
    if (t.custom_caption !== null) customCaptions[platform] = t.custom_caption;
    if (platform === "youtube") {
      youtube = {
        title: String(t.options.title ?? ""),
        privacy: (t.options.privacy as YouTubeOptions["privacy"]) ?? "public",
        format: t.options.format === "short" ? "short" : "video",
      };
    }
    if (platform === "instagram" && t.options.format === "story") instagram = { format: "story" };
    if (platform === "facebook" && t.options.format === "story") facebook = { format: "story" };
    if (platform === "pinterest") {
      pinterest = {
        title: String(t.options.title ?? ""),
        link: String(t.options.link ?? ""),
        boards: t.options.boardId
          ? { ...pinterest.boards, [t.social_account_id]: String(t.options.boardId) }
          : pinterest.boards,
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
    instagram,
    facebook,
    pinterest,
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

// The tabs on the Posts page, and which post statuses each one shows.
// "Failed" includes partly published posts, since both need a retry.
export const POST_TABS = {
  all: { label: "All", statuses: null },
  draft: { label: "Drafts", statuses: ["draft"] },
  scheduled: { label: "Scheduled", statuses: ["scheduled", "publishing"] },
  published: { label: "Published", statuses: ["published"] },
  failed: { label: "Failed", statuses: ["failed", "partially_published"] },
} as const satisfies Record<string, { label: string; statuses: readonly PostStatus[] | null }>;
export type PostTab = keyof typeof POST_TABS;

// The user's posts on one tab, newest first, for the Posts page.
export async function getPosts(tab: PostTab = "all"): Promise<PostListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("posts")
    .select(
      `id, caption, status, scheduled_at, published_at, updated_at,
       post_media ( position, media ( storage_path, mime_type ) ),
       post_targets ( custom_caption, social_accounts ( platform ) )`
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  const statuses = POST_TABS[tab].statuses;
  if (statuses) query = query.in("status", [...statuses]);
  const { data, error } = await query;
  if (error) throw new Error(`Couldn't load posts: ${error.message}`);

  type Row = {
    id: string;
    caption: string;
    status: PostStatus;
    scheduled_at: string | null;
    published_at: string | null;
    updated_at: string;
    post_media: { position: number; media: { storage_path: string; mime_type: string } | null }[];
    post_targets: { custom_caption: string | null; social_accounts: { platform: PlatformId } | null }[];
  };

  return (data as unknown as Row[]).map((p) => {
    const first = [...p.post_media].sort((a, b) => a.position - b.position)[0]?.media;
    const platforms = new Set(p.post_targets.map((t) => t.social_accounts?.platform).filter(Boolean));
    return {
      id: p.id,
      caption: displayCaption(p.caption, p.post_targets),
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

// Posts published by each Instagram account in the last 24 hours (Instagram allows 100).
export async function getInstagramPostsToday(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("post_targets")
    .select("social_account_id, social_accounts!inner ( platform )")
    .eq("status", "published")
    .eq("social_accounts.platform", "instagram")
    .gte("published_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .limit(1000);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { social_account_id: string }[]) {
    counts[row.social_account_id] = (counts[row.social_account_id] ?? 0) + 1;
  }
  return counts;
}

// How many posts are on each Posts tab (for the tab labels).
export async function getPostCounts(): Promise<Record<PostTab, number>> {
  const supabase = await createClient();
  const tabs = Object.keys(POST_TABS) as PostTab[];
  const counts = await Promise.all(
    tabs.map(async (tab) => {
      let query = supabase.from("posts").select("id", { count: "exact", head: true });
      const statuses = POST_TABS[tab].statuses;
      if (statuses) query = query.in("status", [...statuses]);
      const { count } = await query;
      return [tab, count ?? 0] as const;
    })
  );
  return Object.fromEntries(counts) as Record<PostTab, number>;
}

// Failed or partly published posts, for the red count in the menu.
export const getFailedPostCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .in("status", [...POST_TABS.failed.statuses]);
  return count ?? 0;
});

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
       post_targets ( id, status, custom_caption, external_url, error_message, published_at,
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
      custom_caption: string | null;
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
    caption: displayCaption(p.caption, p.post_targets),
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
    .select("id, status, caption, scheduled_at, published_at, post_targets ( custom_caption, social_accounts ( platform ) )")
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
    post_targets: { custom_caption: string | null; social_accounts: { platform: PlatformId } | null }[];
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
        caption: displayCaption(p.caption, p.post_targets),
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

// The user's weekly queue times, Monday first.
export async function getQueueSlots(): Promise<QueueSlot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("queue_slots").select("id, weekday, time").order("weekday").order("time");
  if (error) throw new Error(`Couldn't load your queue: ${error.message}`);
  // Postgres sends times as "09:00:00".
  return (data as QueueSlot[]).map((s) => ({ ...s, time: s.time.slice(0, 5) }));
}

// When "Add to queue" would schedule a post: the earliest queue time that has no
// scheduled post yet. Null if there are no queue times, or all are taken for weeks.
export async function getNextFreeSlot(timeZone: string, slots?: QueueSlot[]): Promise<Date | null> {
  slots ??= await getQueueSlots();
  if (slots.length === 0) return null;

  // A few minutes ahead, because scheduling needs at least 2 minutes' notice.
  const from = new Date(Date.now() + 5 * 60 * 1000);
  const until = new Date(from.getTime() + QUEUE_HORIZON_DAYS * 24 * 60 * 60 * 1000);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("scheduled_at")
    .in("status", ["scheduled", "publishing"])
    .gte("scheduled_at", from.toISOString())
    .lt("scheduled_at", until.toISOString());
  if (error) throw new Error(`Couldn't check your queue: ${error.message}`);

  const taken = new Set((data as { scheduled_at: string }[]).map((p) => minuteOf(p.scheduled_at)));
  return upcomingSlotTimes(slots, timeZone, from, QUEUE_HORIZON_DAYS).find((at) => !taken.has(minuteOf(at))) ?? null;
}

export type QueueItem = {
  at: string; // ISO time
  isSlot: boolean; // one of the user's queue times (otherwise a post scheduled at another time)
  post: { id: string; caption: string; platforms: PlatformId[] } | null; // null = free queue time
};

// The next `days` days of the queue: every queue time (free or filled) plus any
// other scheduled posts, earliest first.
export async function getQueueOverview(timeZone: string, slots: QueueSlot[], days = 14): Promise<QueueItem[]> {
  const now = new Date();
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const scheduled = (await getCalendarPosts(now.toISOString(), until.toISOString(), timeZone)).filter(
    (p) => p.status === "scheduled" || p.status === "publishing"
  );

  const items: QueueItem[] = upcomingSlotTimes(slots, timeZone, now, days).map((at) => ({
    at: at.toISOString(),
    isSlot: true,
    post: null,
  }));
  for (const p of scheduled) {
    const post = { id: p.id, caption: p.caption, platforms: p.platforms };
    const slot = items.find((i) => i.isSlot && !i.post && minuteOf(i.at) === minuteOf(p.at));
    if (slot) slot.post = post;
    else items.push({ at: p.at, isSlot: false, post });
  }
  return items.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

// The best weekday + hour to post, from the engagement on posts published in the
// last 90 days. Posts from the last 24 hours are skipped while their numbers grow.
// `cache`: Create and Queue can both ask during one request.
export const getBestTimes = cache(async (timeZone: string): Promise<BestTimes> => {
  const supabase = await createClient();
  const now = Date.now();
  const { data, error } = await supabase
    .from("post_targets")
    .select("published_at, post_metrics ( likes, comments, shares )")
    .eq("status", "published")
    .gte("published_at", new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString())
    .lt("published_at", new Date(now - 24 * 60 * 60 * 1000).toISOString())
    .limit(1000);
  if (error) throw new Error(`Couldn't work out your best times: ${error.message}`);

  type MetricRow = { likes: number | null; comments: number | null; shares: number | null };
  type Row = { published_at: string; post_metrics: MetricRow | MetricRow[] | null };
  const posts = (data as unknown as Row[]).flatMap((t) => {
    const m = Array.isArray(t.post_metrics) ? t.post_metrics[0] : t.post_metrics;
    if (!m) return []; // numbers not collected yet
    const score = engagementScore({
      likes: Number(m.likes ?? 0),
      comments: Number(m.comments ?? 0),
      shares: Number(m.shares ?? 0),
    });
    return [{ publishedAt: t.published_at, score }];
  });
  return rankBestTimes(posts, timeZone);
});

// The best times as their next dates, for the Schedule panel on Create:
// e.g. Tuesday 11:00 -> { label: "Tue 11:00 AM", local: "2026-10-20T11:00" }.
export async function getBestTimeSuggestions(timeZone: string) {
  const best = await getBestTimes(timeZone);
  const soon = new Date(Date.now() + 5 * 60 * 1000);
  const label = new Intl.DateTimeFormat("en", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone });
  return {
    personal: best.personal,
    times: best.times.flatMap((t) => {
      const [at] = upcomingSlotTimes([{ id: "", ...t }], timeZone, soon, 8);
      return at ? [{ label: label.format(at), local: utcToZonedInput(at, timeZone) }] : [];
    }),
  };
}

// The logged-in user's link-in-bio page (null until they first save it) and its links.
export async function getMyBioPage(): Promise<{ page: BioPage | null; links: BioLink[]; avatarUrl: string | null }> {
  const supabase = await createClient();
  const [pageRes, linksRes, profileRes] = await Promise.all([
    supabase.from("bio_pages").select("handle, title, bio, published").maybeSingle<BioPage>(),
    supabase.from("bio_links").select("id, title, url").order("position").order("created_at"),
    supabase.from("profiles").select("avatar_url").maybeSingle(),
  ]);
  if (pageRes.error || linksRes.error) {
    throw new Error(`Couldn't load your link-in-bio page: ${(pageRes.error ?? linksRes.error)!.message}`);
  }
  return {
    page: pageRes.data,
    links: (linksRes.data ?? []) as BioLink[],
    avatarUrl: (profileRes.data?.avatar_url as string | null) ?? null,
  };
}

// A published link-in-bio page, for anyone (no login). Uses the secret key because
// visitors have no database access of their own, so it only ever reads published
// pages, and only the columns the page shows.
export const getPublicBioPage = cache(async (handle: string) => {
  const admin = createAdminClient();
  const { data: page, error } = await admin
    .from("bio_pages")
    .select("user_id, title, bio")
    .eq("handle", handle)
    .eq("published", true)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load this page: ${error.message}`);
  if (!page) return null;

  const [linksRes, profileRes] = await Promise.all([
    admin.from("bio_links").select("id, title, url").eq("user_id", page.user_id).order("position").order("created_at"),
    admin.from("profiles").select("avatar_url").eq("id", page.user_id).maybeSingle(),
  ]);
  return {
    title: page.title as string,
    bio: page.bio as string,
    avatarUrl: (profileRes.data?.avatar_url as string | null) ?? null,
    links: (linksRes.data ?? []) as BioLink[],
  };
});

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
