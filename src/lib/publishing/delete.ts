import "server-only";
import { blueskyLogin } from "@/lib/connectors/bluesky";
import { threadsApi } from "@/lib/connectors/threads";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { createAdminClient } from "@/lib/supabase/admin";
import { graph } from "./graph";
import { getAccessToken } from "./tokens";
import { PublishError } from "./types";

// Deletes posts: from SocialFlow, and optionally from the platforms they went out to.
// Docs: Facebook/Instagram (Graph API DELETE /{id}; Instagram needs instagram_manage_contents),
// YouTube videos.delete, Bluesky deletePost, Threads DELETE /{id} (needs threads_delete).

export type PlatformDeleteResult = { account: string; platform: PlatformId; ok: boolean; message?: string };
export type DeleteOutcome = { removed: boolean; results: PlatformDeleteResult[] };

const platformName = (id: PlatformId) => PLATFORMS.find((p) => p.id === id)?.name ?? id;

// Statuses that can be deleted here. Scheduled or publishing posts must be cancelled first.
const DELETABLE = ["draft", "failed", "partially_published", "published"];

async function deleteOnPlatform(platform: PlatformId, externalId: string, accountId: string, platformAccountId: string) {
  const admin = createAdminClient();
  const token = await getAccessToken(admin, accountId, platform);
  switch (platform) {
    case "facebook":
    case "instagram":
      await graph("DELETE", `/${externalId}`, {}, token);
      return;
    case "threads":
      await threadsApi("DELETE", `/${externalId}`, {}, token);
      return;
    case "youtube": {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(externalId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) return; // already gone
      if (!res.ok) throw new PublishError(res.status === 401 || res.status === 403 ? "YouTube didn't allow it. Reconnect YouTube and try again." : `YouTube returned error ${res.status}.`);
      return;
    }
    case "bluesky": {
      const agent = await blueskyLogin(platformAccountId, token);
      await agent.deletePost(externalId);
      return;
    }
  }
}

// Deletes one post. With `fromPlatforms`, each published copy is deleted first; the post
// is only removed from SocialFlow if every one of those succeeded, so nothing is lost silently.
export async function deletePost(postId: string, userId: string, fromPlatforms: boolean): Promise<DeleteOutcome & { error?: string }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("posts")
    .select(
      "id, status, post_targets ( id, status, external_post_id, social_accounts ( id, platform, platform_account_id, display_name, username ) )"
    )
    .eq("id", postId)
    .eq("user_id", userId) // the secret-key client skips Row Level Security, so check ownership here
    .maybeSingle();
  if (!data) return { removed: false, results: [], error: "That post doesn't exist." };

  type Target = {
    id: string;
    status: string;
    external_post_id: string | null;
    social_accounts: { id: string; platform: PlatformId; platform_account_id: string; display_name: string | null; username: string | null } | null;
  };
  const post = data as unknown as { id: string; status: string; post_targets: Target[] };
  if (!DELETABLE.includes(post.status)) {
    return { removed: false, results: [], error: "Cancel the schedule first, then delete it." };
  }

  const results: PlatformDeleteResult[] = [];
  if (fromPlatforms) {
    for (const t of post.post_targets) {
      const account = t.social_accounts;
      if (t.status !== "published" || !t.external_post_id || !account) continue;
      const name = account.display_name ?? account.username ?? platformName(account.platform);
      try {
        await deleteOnPlatform(account.platform, t.external_post_id, account.id, account.platform_account_id);
        // Forget the deleted copy, so trying again after another platform refused skips it.
        await admin.from("post_targets").update({ external_post_id: null, external_url: null }).eq("id", t.id);
        results.push({ account: name, platform: account.platform, ok: true });
      } catch (err) {
        // A missing permission or expired login is reported, but never marks the account
        // as needing reconnection: deleting is optional, publishing must keep working.
        const message = err instanceof PublishError ? err.message : `Couldn't delete it from ${platformName(account.platform)}.`;
        if (!(err instanceof PublishError)) console.error(`[delete] ${account.platform}:`, err);
        results.push({ account: name, platform: account.platform, ok: false, message });
      }
    }
    if (results.some((r) => !r.ok)) return { removed: false, results };
  }

  const { error } = await admin.from("posts").delete().eq("id", postId).eq("user_id", userId);
  if (error) return { removed: false, results, error: "Couldn't remove it from SocialFlow. Try again." };
  return { removed: true, results };
}
