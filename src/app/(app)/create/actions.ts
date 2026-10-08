"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PlatformId } from "@/lib/platforms";
import type { YouTubeOptions } from "@/lib/post-rules";

export type DraftInput = {
  postId: string | null;
  caption: string;
  mediaIds: string[];
  accountIds: string[];
  customCaptions: Partial<Record<PlatformId, string>>;
  youtube: YouTubeOptions;
};

export type SaveResult = { postId?: string; error?: string };

// Creates or updates a draft post, its media list, and the accounts it goes to.
// Row Level Security makes sure the media and accounts belong to this user.
export async function saveDraft(input: DraftInput): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  if (!input.caption.trim() && input.mediaIds.length === 0) {
    return { error: "Write something or add a photo or video first." };
  }

  // Look up each account's platform ourselves rather than trusting the browser.
  const { data: accounts, error: accountsError } = await supabase
    .from("social_accounts")
    .select("id, platform")
    .in("id", input.accountIds.length ? input.accountIds : ["00000000-0000-0000-0000-000000000000"]);
  if (accountsError) return { error: "Couldn't check your accounts. Try again." };

  // 1. The post itself.
  let postId = input.postId;
  if (postId) {
    const { data: existing, error } = await supabase
      .from("posts")
      .update({ caption: input.caption })
      .eq("id", postId)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (error) return { error: "Couldn't save the draft. Try again." };
    if (!existing) return { error: "This post can't be edited any more (it may already be scheduled or published)." };
  } else {
    const { data: created, error } = await supabase
      .from("posts")
      .insert({ caption: input.caption, status: "draft" })
      .select("id")
      .single();
    if (error) return { error: "Couldn't save the draft. Try again." };
    postId = created.id as string;
  }

  // 2. Replace the media list and targets with what's on screen now.
  const { error: clearMediaError } = await supabase.from("post_media").delete().eq("post_id", postId);
  const { error: clearTargetsError } = await supabase.from("post_targets").delete().eq("post_id", postId);
  if (clearMediaError || clearTargetsError) return { postId, error: "Couldn't save the draft. Try again." };

  if (input.mediaIds.length) {
    const { error } = await supabase.from("post_media").insert(
      input.mediaIds.map((mediaId, position) => ({ post_id: postId, media_id: mediaId, position }))
    );
    if (error) return { postId, error: "Couldn't attach your media. Try again." };
  }

  if (accounts.length) {
    const { error } = await supabase.from("post_targets").insert(
      accounts.map((a) => {
        const platform = a.platform as PlatformId;
        return {
          post_id: postId,
          social_account_id: a.id,
          custom_caption: input.customCaptions[platform] ?? null,
          options:
            platform === "youtube"
              ? { title: input.youtube.title.trim(), privacy: input.youtube.privacy }
              : {},
        };
      })
    );
    if (error) return { postId, error: "Couldn't save the chosen accounts. Try again." };
  }

  revalidatePath("/posts");
  revalidatePath("/dashboard");
  return { postId };
}

export async function deleteDraft(postId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("status", "draft");
  if (error) throw new Error("Couldn't delete the draft. Try again.");
  revalidatePath("/posts");
  revalidatePath("/dashboard");
}
