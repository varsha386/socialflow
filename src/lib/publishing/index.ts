import "server-only";
import { markNeedsReconnecting } from "@/lib/email/alerts";
import { mediaUrl } from "@/lib/media";
import type { PlatformId } from "@/lib/platforms";
import {
  INSTAGRAM_POSTS_PER_DAY,
  THREADS_POSTS_PER_DAY,
  checkPost,
  type InstagramOptions,
  type MediaItem,
  type PinterestPin,
  type YouTubeOptions,
} from "@/lib/post-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PostStatus } from "@/lib/types";
import { publishToBluesky } from "./bluesky";
import { publishToFacebook } from "./facebook";
import { publishToInstagram } from "./instagram";
import { publishToLinkedIn } from "./linkedin";
import { publishToPinterest } from "./pinterest";
import { publishToThreads } from "./threads";
import { getAccessToken } from "./tokens";
import { PublishError, type PublishJob, type PublishResult } from "./types";
import { publishToYouTube } from "./youtube";

const PUBLISHERS: Record<PlatformId, (job: PublishJob) => Promise<PublishResult>> = {
  facebook: publishToFacebook,
  instagram: publishToInstagram,
  youtube: publishToYouTube,
  bluesky: publishToBluesky,
  threads: publishToThreads,
  linkedin: publishToLinkedIn,
  pinterest: publishToPinterest,
};

// Posts in these states may be (re)published.
const PUBLISHABLE: PostStatus[] = ["draft", "scheduled", "failed", "partially_published"];

export type PublishOutcome = { error: string } | { status: PostStatus };

type TargetRow = {
  id: string;
  status: "pending" | "publishing" | "published" | "failed";
  custom_caption: string | null;
  options: Record<string, unknown>;
  social_accounts: {
    id: string;
    platform: PlatformId;
    platform_account_id: string;
    display_name: string | null;
  } | null;
};

type Prepared = {
  post: { id: string; caption: string; status: PostStatus };
  media: MediaItem[];
  todo: TargetRow[];
  captionFor: (t: TargetRow) => string;
  youtubeOptions: (t: TargetRow) => YouTubeOptions;
  instagramOptions: (t: TargetRow) => InstagramOptions;
  pinterestPin: (t: TargetRow) => PinterestPin;
};

// Loads a post and checks it's ready to go to every account it targets.
// Returns an error message to show, or everything needed to publish it.
async function prepare(
  admin: ReturnType<typeof createAdminClient>,
  postId: string,
  userId: string
): Promise<{ error: string } | Prepared> {
  const { data, error } = await admin
    .from("posts")
    .select(
      `id, caption, status,
       post_media ( position, media ( id, storage_path, mime_type, size_bytes, width, height, duration_seconds ) ),
       post_targets ( id, status, custom_caption, options,
         social_accounts ( id, platform, platform_account_id, display_name ) )`
    )
    .eq("id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { error: "Couldn't load the post. Try again." };
  if (!data) return { error: "That post doesn't exist." };

  const post = data as unknown as {
    id: string;
    caption: string;
    status: PostStatus;
    post_media: { position: number; media: Record<string, unknown> | null }[];
    post_targets: TargetRow[];
  };

  if (!PUBLISHABLE.includes(post.status)) {
    return { error: post.status === "publishing" ? "This post is already being published." : "This post is already published." };
  }

  const media: MediaItem[] = post.post_media
    .filter((pm) => pm.media)
    .sort((a, b) => a.position - b.position)
    .map(({ media: m }) => ({
      id: m!.id as string,
      url: mediaUrl(m!.storage_path as string),
      storagePath: m!.storage_path as string,
      mimeType: m!.mime_type as string,
      kind: (m!.mime_type as string).startsWith("video/") ? "video" : "image",
      sizeBytes: m!.size_bytes as number,
      width: m!.width as number | null,
      height: m!.height as number | null,
      durationSeconds: m!.duration_seconds as number | null,
    }));

  const todo = post.post_targets.filter((t) => t.status !== "published" && t.social_accounts);
  if (todo.length === 0) return { error: "Choose at least one account to post to." };

  const youtubeOptions = (t: TargetRow): YouTubeOptions => ({
    title: String(t.options.title ?? ""),
    privacy: (t.options.privacy as YouTubeOptions["privacy"]) ?? "public",
  });
  const instagramOptions = (t: TargetRow): InstagramOptions => ({
    format: t.options.format === "story" ? "story" : "feed",
  });
  const pinterestPin = (t: TargetRow): PinterestPin => ({
    boardId: String(t.options.boardId ?? ""),
    title: String(t.options.title ?? ""),
    link: String(t.options.link ?? ""),
  });
  const captionFor = (t: TargetRow) => t.custom_caption ?? post.caption;

  // Check every target before sending anything.
  for (const t of todo) {
    const platform = t.social_accounts!.platform;
    const pin = pinterestPin(t);
    const problems = checkPost(platform, captionFor(t), media, youtubeOptions(t), instagramOptions(t), {
      title: pin.title,
      link: pin.link,
      boards: {},
    });
    if (platform === "pinterest" && !pin.boardId) problems.push("Choose a board for the Pin.");
    if (problems.length) {
      return { error: `${t.social_accounts!.display_name ?? platform}: ${problems.join(" ")}` };
    }
  }

  return { post, media, todo, captionFor, youtubeOptions, instagramOptions, pinterestPin };
}

// Checks a post could be published, without publishing it (used before scheduling).
export async function checkReadyToPublish(postId: string, userId: string): Promise<string | null> {
  const prepared = await prepare(createAdminClient(), postId, userId);
  return "error" in prepared ? prepared.error : null;
}

// Publishes a post to every account it targets (skipping ones already published,
// so this also works as "retry"). Uses the admin client so it can also run in the
// background (scheduled posts), so it always checks the post belongs to userId.
export async function publishPost(postId: string, userId: string): Promise<PublishOutcome> {
  const admin = createAdminClient();
  const prepared = await prepare(admin, postId, userId);
  if ("error" in prepared) return prepared;
  const { media, todo, captionFor, youtubeOptions, instagramOptions, pinterestPin } = prepared;

  // Instagram allows 100 posts per account in a rolling 24 hours, Threads 250. Checked here
  // (when it actually goes out) rather than when scheduling, so a post for tomorrow isn't blocked today.
  const dailyLimits: Partial<Record<PlatformId, { name: string; max: number }>> = {
    instagram: { name: "Instagram", max: INSTAGRAM_POSTS_PER_DAY },
    threads: { name: "Threads", max: THREADS_POSTS_PER_DAY },
  };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  for (const t of todo) {
    const limit = dailyLimits[t.social_accounts!.platform];
    if (!limit) continue;
    const { count } = await admin
      .from("post_targets")
      .select("id", { count: "exact", head: true })
      .eq("social_account_id", t.social_accounts!.id)
      .eq("status", "published")
      .gte("published_at", since);
    if ((count ?? 0) >= limit.max) {
      return {
        error: `${t.social_accounts!.display_name ?? limit.name}: ${limit.name} allows ${limit.max} posts per account in 24 hours, and this account has reached it. Try again later.`,
      };
    }
  }

  // Claim the post. Only one request can move it to "publishing", so a
  // double-click (or a scheduler running twice) can't publish it twice.
  const { data: claimed } = await admin
    .from("posts")
    .update({ status: "publishing" })
    .eq("id", postId)
    .in("status", PUBLISHABLE)
    .select("id")
    .maybeSingle();
  if (!claimed) return { error: "This post is already being published." };

  await admin
    .from("post_targets")
    .update({ status: "publishing", error_message: null })
    .in("id", todo.map((t) => t.id));

  // Send to every account at the same time.
  await Promise.all(
    todo.map(async (t) => {
      const account = t.social_accounts!;
      try {
        const accessToken = await getAccessToken(admin, account.id, account.platform);
        const result = await PUBLISHERS[account.platform]({
          platformAccountId: account.platform_account_id,
          accessToken,
          caption: captionFor(t),
          media,
          youtube: youtubeOptions(t),
          instagram: instagramOptions(t),
          pinterest: pinterestPin(t),
        });
        await admin
          .from("post_targets")
          .update({
            status: "published",
            external_post_id: result.externalId,
            external_url: result.url,
            published_at: new Date().toISOString(),
          })
          .eq("id", t.id);
      } catch (err) {
        const known = err instanceof PublishError;
        if (!known) console.error(`[publish] ${account.platform} target ${t.id} failed:`, err);
        await admin
          .from("post_targets")
          .update({
            status: "failed",
            error_message: known ? err.message : "Something went wrong. Try again.",
          })
          .eq("id", t.id);
        if (known && err.reconnect) {
          await markNeedsReconnecting(admin, account.id);
        }
      }
    })
  );

  // Work out the post's overall status from all its targets.
  const { data: finalTargets } = await admin
    .from("post_targets")
    .select("status")
    .eq("post_id", postId);
  const statuses = (finalTargets ?? []).map((t) => t.status as string);
  const published = statuses.filter((s) => s === "published").length;
  const status: PostStatus =
    published === statuses.length ? "published" : published === 0 ? "failed" : "partially_published";

  await admin
    .from("posts")
    .update({ status, ...(published > 0 ? { published_at: new Date().toISOString() } : {}) })
    .eq("id", postId);

  return { status };
}
