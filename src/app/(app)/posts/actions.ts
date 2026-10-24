"use server";

import { revalidatePath } from "next/cache";
import { deletePost, type PlatformDeleteResult } from "@/lib/publishing/delete";
import { createClient } from "@/lib/supabase/server";

export type DeletePostsResult = {
  removed: number; // posts removed from SocialFlow
  kept: { postId: string; reason: string; results: PlatformDeleteResult[] }[]; // left in place, with why
  error?: string;
};

const MAX_AT_ONCE = 25;

// Deletes posts from SocialFlow, and with `fromPlatforms`, from the platforms too.
export async function deletePosts(postIds: string[], fromPlatforms: boolean): Promise<DeletePostsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { removed: 0, kept: [], error: "Your session expired. Log in again." };

  const ids = [...new Set(postIds)].slice(0, MAX_AT_ONCE);
  let removed = 0;
  const kept: DeletePostsResult["kept"] = [];
  for (const id of ids) {
    const outcome = await deletePost(id, user.id, fromPlatforms);
    if (outcome.removed) removed++;
    else {
      const failed = outcome.results.filter((r) => !r.ok);
      kept.push({
        postId: id,
        reason: outcome.error ?? failed.map((r) => `${r.account}: ${r.message}`).join(" "),
        results: outcome.results,
      });
    }
  }

  revalidatePath("/posts", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/analytics");
  return {
    removed,
    kept,
    ...(postIds.length > MAX_AT_ONCE ? { error: `Only the first ${MAX_AT_ONCE} were handled. Select the rest and try again.` } : {}),
  };
}
