"use server";

import { revalidatePath } from "next/cache";
import { getNextFreeSlot } from "@/lib/data";
import { scheduleLimitError } from "@/lib/plan-limits";
import { createClient } from "@/lib/supabase/server";
import type { PlatformId } from "@/lib/platforms";
import type { FacebookOptions, InstagramOptions, PinterestOptions, YouTubeOptions } from "@/lib/post-rules";
import { listPinterestBoards, pinterestApi, type PinterestBoard } from "@/lib/connectors/pinterest";
import { checkReadyToPublish } from "@/lib/publishing";
import { getAccessToken } from "@/lib/publishing/tokens";
import { PublishError } from "@/lib/publishing/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { zonedTimeToUtc } from "@/lib/timezone";
import { POST_SCHEDULED, inngest, type PostScheduledData } from "@/inngest/client";

export type DraftInput = {
  postId: string | null;
  caption: string;
  mediaIds: string[];
  accountIds: string[];
  customCaptions: Partial<Record<PlatformId, string>>;
  youtube: YouTubeOptions;
  instagram?: InstagramOptions; // Bulk upload leaves it out: always the feed
  facebook?: FacebookOptions; // Bulk upload leaves it out: always the feed
  pinterest?: PinterestOptions; // Bulk upload leaves it out (it has no Pinterest accounts)
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

  // Look up each account's platform ourselves rather than trusting the browser.
  const { data: accounts, error: accountsError } = await supabase
    .from("social_accounts")
    .select("id, platform")
    .in("id", input.accountIds.length ? input.accountIds : ["00000000-0000-0000-0000-000000000000"]);
  if (accountsError) return { error: "Couldn't check your accounts. Try again." };

  // A caption typed only on a platform's tab (e.g. just "Facebook") counts too,
  // as long as that platform is one of the chosen accounts.
  const hasCaption =
    input.caption.trim() !== "" ||
    accounts.some((a) => input.customCaptions[a.platform as PlatformId]?.trim());
  if (!hasCaption && input.mediaIds.length === 0) {
    return { error: "Write something or add a photo or video first." };
  }

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
              ? { title: input.youtube.title.trim(), privacy: input.youtube.privacy, format: input.youtube.format ?? "video" }
              : (platform === "instagram" && input.instagram?.format === "story") ||
                  (platform === "facebook" && input.facebook?.format === "story")
                ? { format: "story" }
                : platform === "pinterest"
                  ? {
                      boardId: input.pinterest?.boards[a.id] ?? null,
                      title: input.pinterest?.title.trim() ?? "",
                      link: input.pinterest?.link.trim() ?? "",
                    }
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

// The boards of one of the user's Pinterest accounts, for choosing where a Pin goes.
export async function getPinterestBoards(accountId: string): Promise<{ boards?: PinterestBoard[]; error?: string }> {
  const supabase = await createClient();
  // Row Level Security only returns the account if it's this user's.
  const { data: account } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("platform", "pinterest")
    .maybeSingle();
  if (!account) return { error: "That Pinterest account isn't connected." };

  try {
    const token = await getAccessToken(createAdminClient(), account.id, "pinterest");
    return { boards: await listPinterestBoards(token) };
  } catch (err) {
    if (!(err instanceof PublishError)) console.error("[pinterest] couldn't load boards:", err);
    return { error: err instanceof PublishError ? err.message : "Couldn't load your Pinterest boards. Try again." };
  }
}

// Makes a new public board on one of the user's Pinterest accounts.
export async function createPinterestBoard(accountId: string, name: string): Promise<{ board?: PinterestBoard; error?: string }> {
  const boardName = name.trim();
  if (!boardName || boardName.length > 50) return { error: "Give the board a name of up to 50 characters." };
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("platform", "pinterest")
    .maybeSingle();
  if (!account) return { error: "That Pinterest account isn't connected." };

  try {
    const token = await getAccessToken(createAdminClient(), account.id, "pinterest");
    const board = await pinterestApi<PinterestBoard>("POST", "/boards", token, { name: boardName, privacy: "PUBLIC" });
    return { board: { id: board.id, name: board.name } };
  } catch (err) {
    if (!(err instanceof PublishError)) console.error("[pinterest] couldn't create a board:", err);
    return { error: err instanceof PublishError ? err.message : "Couldn't create the board. Try again." };
  }
}

export async function deleteDraft(postId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("status", "draft");
  if (error) throw new Error("Couldn't delete the draft. Try again.");
  revalidatePath("/posts");
  revalidatePath("/dashboard");
}

export type ScheduleResult = { error?: string; scheduledAt?: string };

// Schedules a saved draft for `localDateTime` ("2026-10-15T19:00") in the user's time zone.
export async function schedulePost(postId: string, localDateTime: string): Promise<ScheduleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
  const timeZone = profile?.timezone ?? "UTC";

  const when = zonedTimeToUtc(localDateTime, timeZone);
  if (!when) return { error: "Choose a date and time." };
  return scheduleAt(postId, user.id, when);
}

// Schedules a saved draft at the next free time in the user's posting queue.
export async function addToQueue(postId: string): Promise<ScheduleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
  const when = await getNextFreeSlot(profile?.timezone ?? "UTC");
  if (!when) {
    return { error: "Your queue has no free times in the next 8 weeks. Add more posting times on the Queue page." };
  }
  return scheduleAt(postId, user.id, when);
}

// Shared by "Schedule" and "Add to queue": checks the time and the post, then
// marks it scheduled and tells the scheduler (Inngest).
async function scheduleAt(postId: string, userId: string, when: Date): Promise<ScheduleResult> {
  const supabase = await createClient();
  if (when.getTime() < Date.now() + 2 * 60 * 1000) return { error: "Choose a time at least 2 minutes from now." };
  if (when.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000) return { error: "Choose a time within the next year." };

  // Free plan: a monthly number of scheduled posts.
  const overLimit = await scheduleLimitError(userId, postId, when);
  if (overLimit) return { error: overLimit };

  // Run the same checks as "Publish now", so problems show up today, not at 7 PM.
  const problem = await checkReadyToPublish(postId, userId);
  if (problem) return { error: problem };

  const scheduledAt = when.toISOString();
  const { data: updated, error } = await supabase
    .from("posts")
    .update({ status: "scheduled", scheduled_at: scheduledAt })
    .eq("id", postId)
    .in("status", ["draft", "scheduled"])
    .select("id")
    .maybeSingle();
  if (error || !updated) return { error: "Couldn't schedule this post. Try again." };

  try {
    await inngest.send({
      name: POST_SCHEDULED,
      data: { postId, userId, scheduledAt } satisfies PostScheduledData,
    });
  } catch (err) {
    console.error("[schedule] couldn't reach Inngest:", err);
    // Put it back to a draft so it isn't left "scheduled" with nothing to publish it.
    await supabase.from("posts").update({ status: "draft", scheduled_at: null }).eq("id", postId);
    return { error: "The scheduler isn't reachable right now, so the post was kept as a draft. Try again." };
  }

  revalidatePath("/posts");
  revalidatePath("/dashboard");
  revalidatePath("/queue");
  return { scheduledAt };
}

// Turns a scheduled post back into a draft. Its waiting Inngest run will find
// it's no longer scheduled and do nothing.
export async function unschedulePost(postId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .update({ status: "draft", scheduled_at: null })
    .eq("id", postId)
    .eq("status", "scheduled")
    .select("id")
    .maybeSingle();
  if (error) return { error: "Couldn't cancel the schedule. Try again." };
  if (!data) return { error: "This post isn't scheduled any more (it may already be publishing)." };
  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/dashboard");
  revalidatePath("/queue");
  return {};
}
