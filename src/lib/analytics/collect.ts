import "server-only";
import type { PlatformId } from "@/lib/platforms";
import { graph } from "@/lib/publishing/graph";
import { getAccessToken } from "@/lib/publishing/tokens";
import { PublishError } from "@/lib/publishing/types";
import { createAdminClient } from "@/lib/supabase/admin";

// Collects the latest numbers from Instagram, Facebook and YouTube for one user:
// follower counts for each connected account, and likes/comments/shares/views for
// posts published in the last 30 days. Saves them to post_metrics and account_metrics.

type Metrics = { views: number | null; likes: number | null; comments: number | null; shares: number | null };
type Account = { id: string; platform: PlatformId; platform_account_id: string };
type Target = { id: string; external_post_id: string; social_account_id: string };

const LOOKBACK_DAYS = 30;
const num = (v: unknown) => (v === undefined || v === null || v === "" ? null : Number(v));

export async function refreshUserMetrics(userId: string) {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: accounts } = await admin
    .from("social_accounts")
    .select("id, platform, platform_account_id")
    .eq("user_id", userId)
    .eq("status", "connected");

  const summary = { accounts: 0, posts: 0, errors: 0 };

  for (const account of (accounts ?? []) as Account[]) {
    let token: string;
    try {
      token = await getAccessToken(admin, account.id, account.platform);
    } catch (err) {
      await handleError(admin, account, err);
      summary.errors++;
      continue;
    }

    // 1. Followers today.
    try {
      const followers = await fetchFollowers(account, token);
      await admin
        .from("account_metrics")
        .upsert({ account_id: account.id, day: today, followers, fetched_at: new Date().toISOString() });
      summary.accounts++;
    } catch (err) {
      await handleError(admin, account, err);
      summary.errors++;
    }

    // 2. Recent posts on this account.
    const { data: targets } = await admin
      .from("post_targets")
      .select("id, external_post_id, social_account_id")
      .eq("social_account_id", account.id)
      .eq("status", "published")
      .not("external_post_id", "is", null)
      .gte("published_at", since)
      .limit(100);
    if (!targets?.length) continue;

    try {
      const metrics = await fetchPostMetrics(account, token, targets as Target[]);
      const rows = [...metrics.entries()].map(([targetId, m]) => ({
        target_id: targetId,
        ...m,
        fetched_at: new Date().toISOString(),
      }));
      if (rows.length) await admin.from("post_metrics").upsert(rows);
      summary.posts += rows.length;
    } catch (err) {
      await handleError(admin, account, err);
      summary.errors++;
    }
  }

  await admin.from("profiles").update({ metrics_refreshed_at: new Date().toISOString() }).eq("id", userId);
  return summary;
}

async function handleError(admin: ReturnType<typeof createAdminClient>, account: Account, err: unknown) {
  if (err instanceof PublishError && err.reconnect) {
    await admin.from("social_accounts").update({ status: "expired" }).eq("id", account.id);
  } else {
    console.error(`[analytics] ${account.platform} ${account.id}:`, err);
  }
}

async function fetchFollowers(account: Account, token: string): Promise<number | null> {
  if (account.platform === "youtube") {
    const res = await youtubeGet("channels", { part: "statistics", id: account.platform_account_id }, token);
    const stats = res.items?.[0]?.statistics;
    return stats?.hiddenSubscriberCount ? null : num(stats?.subscriberCount);
  }
  if (account.platform === "facebook") {
    const page = await graph<{ followers_count?: number; fan_count?: number }>(
      "GET",
      `/${account.platform_account_id}`,
      { fields: "followers_count,fan_count" },
      token
    );
    return num(page.followers_count ?? page.fan_count);
  }
  const ig = await graph<{ followers_count?: number }>(
    "GET",
    `/${account.platform_account_id}`,
    { fields: "followers_count" },
    token
  );
  return num(ig.followers_count);
}

async function fetchPostMetrics(account: Account, token: string, targets: Target[]) {
  const out = new Map<string, Metrics>();

  if (account.platform === "youtube") {
    // Up to 50 videos per request.
    for (let i = 0; i < targets.length; i += 50) {
      const batch = targets.slice(i, i + 50);
      const res = await youtubeGet(
        "videos",
        { part: "statistics", id: batch.map((t) => t.external_post_id).join(",") },
        token
      );
      for (const video of res.items ?? []) {
        const target = batch.find((t) => t.external_post_id === video.id);
        if (!target) continue;
        out.set(target.id, {
          views: num(video.statistics?.viewCount),
          likes: num(video.statistics?.likeCount),
          comments: num(video.statistics?.commentCount),
          shares: null,
        });
      }
    }
    return out;
  }

  for (const target of targets) {
    try {
      out.set(
        target.id,
        account.platform === "facebook"
          ? await facebookPostMetrics(target.external_post_id, token)
          : await instagramPostMetrics(target.external_post_id, token)
      );
    } catch (err) {
      // A deleted post shouldn't stop the others; a lost login should.
      if (err instanceof PublishError && err.reconnect) throw err;
    }
  }
  return out;
}

type Summary = { summary?: { total_count?: number } };

async function facebookPostMetrics(id: string, token: string): Promise<Metrics> {
  try {
    const post = await graph<{ reactions?: Summary; comments?: Summary; shares?: { count?: number } }>(
      "GET",
      `/${id}`,
      { fields: "reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares" },
      token
    );
    return {
      views: null,
      likes: num(post.reactions?.summary?.total_count),
      comments: num(post.comments?.summary?.total_count),
      shares: num(post.shares?.count ?? 0),
    };
  } catch (err) {
    if (err instanceof PublishError && err.reconnect) throw err;
    // Video posts are saved by their video ID, which has different fields.
    const video = await graph<{ likes?: Summary; comments?: Summary }>(
      "GET",
      `/${id}`,
      { fields: "likes.summary(true).limit(0),comments.summary(true).limit(0)" },
      token
    );
    return {
      views: null,
      likes: num(video.likes?.summary?.total_count),
      comments: num(video.comments?.summary?.total_count),
      shares: null,
    };
  }
}

async function instagramPostMetrics(id: string, token: string): Promise<Metrics> {
  const media = await graph<{ like_count?: number; comments_count?: number }>(
    "GET",
    `/${id}`,
    { fields: "like_count,comments_count" },
    token
  );
  return { views: null, likes: num(media.like_count), comments: num(media.comments_count), shares: null };
}

type YouTubeList = {
  items?: {
    id: string;
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
      subscriberCount?: string;
      hiddenSubscriberCount?: boolean;
    };
  }[];
  error?: { message?: string };
};

async function youtubeGet(resource: string, params: Record<string, string>, token: string) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${resource}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json()) as YouTubeList;
  if (res.status === 401) throw new PublishError("YouTube needs you to reconnect your channel.", { reconnect: true });
  if (!res.ok) throw new Error(`YouTube API error: ${body.error?.message ?? res.status}`);
  return body;
}
