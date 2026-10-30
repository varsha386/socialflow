import "server-only";
import { blueskyLogin } from "@/lib/connectors/bluesky";
import { linkedinError, linkedinFetch } from "@/lib/connectors/linkedin";
import { pinterestApi } from "@/lib/connectors/pinterest";
import { threadsApi } from "@/lib/connectors/threads";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { createAdminClient } from "@/lib/supabase/admin";
import { graph } from "./graph";
import { getAccessToken } from "./tokens";
import { PublishError } from "./types";

// Deletes posts: from Ripple, and optionally from the platforms they went out to.
// Docs: Facebook/Instagram (Graph API DELETE /{id}; Instagram needs instagram_manage_contents),
// YouTube videos.delete, Bluesky deletePost, Threads DELETE /{id} (needs threads_delete),
// LinkedIn DELETE /rest/posts/{urn}, Pinterest DELETE /v5/pins/{id}.

export type PlatformDeleteResult = { account: string; platform: PlatformId; ok: boolean; message?: string };
export type DeleteOutcome = { removed: boolean; results: PlatformDeleteResult[] };

const platformName = (id: PlatformId) => PLATFORMS.find((p) => p.id === id)?.name ?? id;

// Statuses that can be deleted here. Scheduled or publishing posts must be cancelled first.
const DELETABLE = ["draft", "failed", "partially_published", "published"];

// How each platform deletes the live copy. A Record (not a switch) makes the compiler
// complain if a platform is added to PlatformId without a way to delete it.
type Deleter = (externalId: string, token: string, platformAccountId: string) => Promise<void>;

const DELETERS: Record<PlatformId, Deleter> = {
  facebook: async (id, token) => {
    await graph("DELETE", `/${id}`, {}, token);
  },
  instagram: async (id, token) => {
    await graph("DELETE", `/${id}`, {}, token);
  },
  threads: async (id, token) => {
    await threadsApi("DELETE", `/${id}`, {}, token);
  },
  pinterest: async (id, token) => {
    await pinterestApi("DELETE", `/pins/${encodeURIComponent(id)}`, token);
  },
  linkedin: async (id, token) => {
    // Deleting is idempotent on LinkedIn: an already-deleted post also succeeds.
    const res = await linkedinFetch("DELETE", `/posts/${encodeURIComponent(id)}`, token);
    if (!res.ok && res.status !== 404) throw await linkedinError(res);
  },
  youtube: async (id, token) => {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return; // already gone
    if (!res.ok) {
      throw new PublishError(
        res.status === 401 || res.status === 403 ? "YouTube didn't allow it. Reconnect YouTube and try again." : `YouTube returned error ${res.status}.`
      );
    }
  },
  bluesky: async (id, token, platformAccountId) => {
    const agent = await blueskyLogin(platformAccountId, token);
    await agent.deletePost(id);
  },
};

async function deleteOnPlatform(platform: PlatformId, externalId: string, accountId: string, platformAccountId: string) {
  const token = await getAccessToken(createAdminClient(), accountId, platform);
  try {
    await DELETERS[platform](externalId, token, platformAccountId);
  } catch (err) {
    // "It doesn't exist" means the copy is already gone, which is what we wanted.
    if (!(err instanceof PublishError && err.notFound)) throw err;
  }
}

// Deletes one post. With `fromPlatforms`, each published copy is deleted first; the post
// is only removed from Ripple if every one of those succeeded, so nothing is lost silently.
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
        const { error: forgetError } = await admin
          .from("post_targets")
          .update({ external_post_id: null, external_url: null })
          .eq("id", t.id);
        if (forgetError) {
          console.error(`[delete] couldn't record the deleted copy on ${account.platform}:`, forgetError.message);
          results.push({ account: name, platform: account.platform, ok: false, message: "Deleted it there, but couldn't record that. Try again." });
        } else {
          results.push({ account: name, platform: account.platform, ok: true });
        }
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

  // Only remove it if it's still in a deletable state: a retry started in another tab while the
  // platform deletes above were running would have moved it to "publishing", and deleting it
  // then would leave live posts with no record here.
  const { data: removedRows, error } = await admin
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", userId)
    .in("status", DELETABLE)
    .select("id");
  if (error) return { removed: false, results, error: "Couldn't remove it from Ripple. Try again." };
  if (!removedRows?.length) {
    return { removed: false, results, error: "This post changed while deleting (it may be publishing again). Check it, then try again." };
  }
  return { removed: true, results };
}
