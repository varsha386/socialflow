import "server-only";
import type { PlatformId } from "@/lib/platforms";
import { graph } from "@/lib/publishing/graph";
import { getAccessToken } from "@/lib/publishing/tokens";
import { PublishError } from "@/lib/publishing/types";
import { createAdminClient } from "@/lib/supabase/admin";

// Collects comments on posts published in the last 30 days, and sends replies.
// Comments are stored in the `comments` table; replies are always attached to the
// thread's top-level comment (that's how all three platforms group replies).

type Admin = ReturnType<typeof createAdminClient>;
type Account = { id: string; platform: PlatformId; platform_account_id: string; username: string | null };
type Target = { id: string; external_post_id: string };

type CommentRow = {
  target_id: string;
  platform_comment_id: string;
  parent_comment_id: string | null;
  author_name: string | null;
  author_avatar_url: string | null;
  text: string;
  is_own: boolean;
  created_at: string;
};

const LOOKBACK_DAYS = 30;

export async function syncUserComments(userId: string) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const summary = { comments: 0, errors: 0 };

  const { data: accounts } = await admin
    .from("social_accounts")
    .select("id, platform, platform_account_id, username")
    .eq("user_id", userId)
    .eq("status", "connected");

  for (const account of (accounts ?? []) as Account[]) {
    const { data: targets } = await admin
      .from("post_targets")
      .select("id, external_post_id")
      .eq("social_account_id", account.id)
      .eq("status", "published")
      .not("external_post_id", "is", null)
      .gte("published_at", since)
      .limit(50);
    if (!targets?.length) continue;

    let token: string;
    try {
      token = await getAccessToken(admin, account.id, account.platform);
    } catch (err) {
      await handleError(admin, account, err);
      summary.errors++;
      continue;
    }

    for (const target of targets as Target[]) {
      try {
        const rows = await fetchComments(account, target, token);
        if (rows.length) {
          await admin.from("comments").upsert(
            rows.map((r) => ({ ...r, synced_at: new Date().toISOString() })),
            { onConflict: "target_id,platform_comment_id" }
          );
        }
        summary.comments += rows.length;
      } catch (err) {
        summary.errors++;
        // A lost login stops this account; anything else (e.g. a deleted post) just skips the post.
        if (err instanceof PublishError && err.reconnect) {
          await handleError(admin, account, err);
          break;
        }
        console.error(`[inbox] ${account.platform} target ${target.id}:`, err);
      }
    }
  }

  await admin.from("profiles").update({ inbox_synced_at: new Date().toISOString() }).eq("id", userId);
  return summary;
}

async function handleError(admin: Admin, account: Account, err: unknown) {
  if (err instanceof PublishError && err.reconnect) {
    await admin.from("social_accounts").update({ status: "expired" }).eq("id", account.id);
  } else {
    console.error(`[inbox] ${account.platform} ${account.id}:`, err);
  }
}

async function fetchComments(account: Account, target: Target, token: string): Promise<CommentRow[]> {
  const base = { target_id: target.id };

  if (account.platform === "youtube") {
    type YTComment = {
      id: string;
      snippet: {
        textOriginal?: string;
        textDisplay?: string;
        authorDisplayName?: string;
        authorProfileImageUrl?: string;
        authorChannelId?: { value?: string };
        publishedAt: string;
        parentId?: string;
      };
    };
    const res = await youtubeFetch<{
      items?: { snippet: { topLevelComment: YTComment }; replies?: { comments?: YTComment[] } }[];
    }>(
      `commentThreads?${new URLSearchParams({
        part: "snippet,replies",
        videoId: target.external_post_id,
        maxResults: "50",
        order: "time",
        textFormat: "plainText",
      })}`,
      token
    );
    const toRow = (c: YTComment, parent: string | null): CommentRow => ({
      ...base,
      platform_comment_id: c.id,
      parent_comment_id: parent,
      author_name: c.snippet.authorDisplayName ?? null,
      author_avatar_url: c.snippet.authorProfileImageUrl ?? null,
      text: c.snippet.textOriginal ?? c.snippet.textDisplay ?? "",
      is_own: c.snippet.authorChannelId?.value === account.platform_account_id,
      created_at: c.snippet.publishedAt,
    });
    return (res.items ?? []).flatMap((thread) => {
      const top = thread.snippet.topLevelComment;
      return [toRow(top, null), ...(thread.replies?.comments ?? []).map((r) => toRow(r, top.id))];
    });
  }

  if (account.platform === "facebook") {
    // filter=stream returns replies too, each with its parent.
    const res = await graph<{
      data?: {
        id: string;
        message?: string;
        created_time: string;
        from?: { id: string; name: string; picture?: { data?: { url?: string } } };
        parent?: { id: string };
      }[];
    }>(
      "GET",
      `/${target.external_post_id}/comments`,
      {
        filter: "stream",
        order: "reverse_chronological",
        limit: "100",
        fields: "id,message,created_time,from{id,name,picture},parent{id}",
      },
      token
    );
    return (res.data ?? []).map((c) => ({
      ...base,
      platform_comment_id: c.id,
      parent_comment_id: c.parent?.id ?? null,
      author_name: c.from?.name ?? null,
      author_avatar_url: c.from?.picture?.data?.url ?? null,
      text: c.message ?? "",
      is_own: c.from?.id === account.platform_account_id,
      created_at: c.created_time,
    }));
  }

  // Instagram
  type IGComment = { id: string; text?: string; username?: string; timestamp: string };
  const res = await graph<{ data?: (IGComment & { replies?: { data?: IGComment[] } })[] }>(
    "GET",
    `/${target.external_post_id}/comments`,
    { fields: "id,text,username,timestamp,replies{id,text,username,timestamp}", limit: "50" },
    token
  );
  const toRow = (c: IGComment, parent: string | null): CommentRow => ({
    ...base,
    platform_comment_id: c.id,
    parent_comment_id: parent,
    author_name: c.username ?? null,
    author_avatar_url: null, // Instagram doesn't share commenters' pictures
    text: c.text ?? "",
    is_own: !!account.username && c.username === account.username,
    created_at: c.timestamp,
  });
  return (res.data ?? []).flatMap((c) => [toRow(c, null), ...(c.replies?.data ?? []).map((r) => toRow(r, c.id))]);
}

// Replies to the thread that `commentId` (our database ID) belongs to.
export async function replyToComment(userId: string, commentId: string, message: string): Promise<{ error?: string }> {
  const text = message.trim();
  if (!text) return { error: "Write a reply first." };
  if (text.length > 2000) return { error: "Keep replies under 2,000 characters." };

  const admin = createAdminClient();
  const { data } = await admin
    .from("comments")
    .select(
      `platform_comment_id, parent_comment_id, target_id,
       post_targets!inner ( posts!inner ( user_id ),
         social_accounts!inner ( id, platform, platform_account_id, username, display_name, avatar_url ) )`
    )
    .eq("id", commentId)
    .maybeSingle();

  type Row = {
    platform_comment_id: string;
    parent_comment_id: string | null;
    target_id: string;
    post_targets: {
      posts: { user_id: string };
      social_accounts: Account & { display_name: string | null; avatar_url: string | null };
    };
  };
  const row = data as unknown as Row | null;
  if (!row || row.post_targets.posts.user_id !== userId) return { error: "That comment doesn't exist." };

  const account = row.post_targets.social_accounts;
  const threadId = row.parent_comment_id ?? row.platform_comment_id;

  try {
    const token = await getAccessToken(admin, account.id, account.platform);
    let replyId: string;

    if (account.platform === "youtube") {
      const res = await youtubeFetch<{ id: string }>(
        "comments?part=snippet",
        token,
        { snippet: { parentId: threadId, textOriginal: text } }
      );
      replyId = res.id;
    } else if (account.platform === "facebook") {
      replyId = (await graph<{ id: string }>("POST", `/${threadId}/comments`, { message: text }, token)).id;
    } else {
      replyId = (await graph<{ id: string }>("POST", `/${threadId}/replies`, { message: text }, token)).id;
    }

    await admin.from("comments").upsert(
      {
        target_id: row.target_id,
        platform_comment_id: replyId,
        parent_comment_id: threadId,
        author_name: account.display_name ?? account.username,
        author_avatar_url: account.avatar_url,
        text,
        is_own: true,
        created_at: new Date().toISOString(),
      },
      { onConflict: "target_id,platform_comment_id" }
    );
    return {};
  } catch (err) {
    if (err instanceof PublishError) {
      if (err.reconnect) await admin.from("social_accounts").update({ status: "expired" }).eq("id", account.id);
      return { error: err.message };
    }
    console.error("[inbox] reply failed:", err);
    return { error: "Couldn't send the reply. Try again." };
  }
}

// GET (or POST with a JSON body) to the YouTube Data API, with friendly errors.
async function youtubeFetch<T>(path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as T & { error?: { message?: string; errors?: { reason?: string }[] } };
  if (res.ok) return json;

  const reason = json.error?.errors?.[0]?.reason ?? "";
  if (res.status === 401) throw new PublishError("YouTube needs you to reconnect your channel.", { reconnect: true });
  if (reason === "insufficientPermissions" || reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT") {
    throw new PublishError("Reconnect YouTube (Connections → Connect another) to allow replies.", { reconnect: true });
  }
  if (reason === "commentsDisabled") throw new PublishError("Comments are turned off for this video.");
  throw new PublishError(json.error?.message ? `YouTube: ${json.error.message}` : `YouTube returned error ${res.status}.`);
}
