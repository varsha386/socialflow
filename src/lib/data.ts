// Functions that read from the database on the server.
// Row Level Security makes sure each query only sees the logged-in user's rows.

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mediaUrl } from "@/lib/media";
import type { PlatformId } from "@/lib/platforms";
import type { MediaItem, YouTubeOptions } from "@/lib/post-rules";
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
