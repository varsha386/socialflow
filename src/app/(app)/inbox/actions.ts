"use server";

import { revalidatePath } from "next/cache";
import { replyToComment, syncUserComments } from "@/lib/inbox";
import { createClient } from "@/lib/supabase/server";

const COOLDOWN_MS = 2 * 60 * 1000;

async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, userId: user?.id ?? null };
}

// "Refresh": collect new comments now (at most once every 2 minutes).
export async function refreshInbox(): Promise<{ error?: string }> {
  const { supabase, userId } = await currentUserId();
  if (!userId) return { error: "Your session expired. Log in again." };

  const { data: profile } = await supabase.from("profiles").select("inbox_synced_at").eq("id", userId).maybeSingle();
  const last = profile?.inbox_synced_at ? Date.parse(profile.inbox_synced_at) : 0;
  const wait = last + COOLDOWN_MS - Date.now();
  if (wait > 0) return { error: `Checked just now. Try again in ${Math.ceil(wait / 1000)} seconds.` };

  const summary = await syncUserComments(userId);
  revalidatePath("/inbox");
  if (summary.errors > 0 && summary.comments === 0) {
    return { error: "Couldn't read comments from some accounts. You may need to reconnect them in Connections." };
  }
  return {};
}

export async function sendReply(commentId: string, message: string): Promise<{ error?: string }> {
  const { userId } = await currentUserId();
  if (!userId) return { error: "Your session expired. Log in again." };
  const result = await replyToComment(userId, commentId, message);
  if (!result.error) revalidatePath("/inbox");
  return result;
}
