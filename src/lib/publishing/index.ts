import "server-only";
import { mediaUrl } from "@/lib/media";
import type { PlatformId } from "@/lib/platforms";
import { checkPost, type MediaItem, type YouTubeOptions } from "@/lib/post-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PostStatus } from "@/lib/types";
import { publishToFacebook } from "./facebook";
import { publishToInstagram } from "./instagram";
import { getAccessToken } from "./tokens";
import { PublishError, type PublishJob, type PublishResult } from "./types";
import { publishToYouTube } from "./youtube";

const PUBLISHERS: Record<PlatformId, (job: PublishJob) => Promise<PublishResult>> = {
  facebook: publishToFacebook,
  instagram: publishToInstagram,
  youtube: publishToYouTube,
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

// Publishes a post to every account it targets (skipping ones already published,
// so this also works as "retry"). Uses the admin client so it can also run in the
// background later (scheduled posts), so it always checks the post belongs to userId.
export async function publishPost(postId: string, userId: string): Promise<PublishOutcome> {
  const admin = createAdminClient();

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
  const captionFor = (t: TargetRow) => t.custom_caption ?? post.caption;

  // Check every target before sending anything.
  for (const t of todo) {
    const platform = t.social_accounts!.platform;
    const problems = checkPost(platform, captionFor(t), media, youtubeOptions(t));
    if (problems.length) {
      return { error: `${t.social_accounts!.display_name ?? platform}: ${problems.join(" ")}` };
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
          await admin.from("social_accounts").update({ status: "expired" }).eq("id", account.id);
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
