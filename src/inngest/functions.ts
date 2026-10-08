import "server-only";
import { publishPost } from "@/lib/publishing";
import { createAdminClient } from "@/lib/supabase/admin";
import { POST_SCHEDULED, inngest, type PostScheduledData } from "./client";

// Long waits are split into chunks of up to 6 days, so posts scheduled far
// ahead also work on plans that limit how long one sleep can last.
const MAX_SLEEP_MS = 6 * 24 * 60 * 60 * 1000;

// Waits until a post's scheduled time, then publishes it.
// If the post was cancelled or moved to another time in the meantime, it does nothing
// (rescheduling sends a new event, which starts a new run for the new time).
export const publishScheduledPost = inngest.createFunction(
  {
    id: "publish-scheduled-post",
    triggers: [{ event: POST_SCHEDULED }],
    retries: 2,
  },
  async ({ event, step }) => {
    const { postId, userId, scheduledAt } = event.data as PostScheduledData;
    const target = new Date(scheduledAt).getTime();

    // Wake-up times are worked out from the event's own timestamp, so they're
    // the same every time Inngest replays this function.
    const startedAt = event.ts ?? target;
    for (let i = 0, wake = startedAt + MAX_SLEEP_MS; wake < target; i++, wake += MAX_SLEEP_MS) {
      await step.sleepUntil(`wait-part-${i + 1}`, new Date(wake));
    }
    await step.sleepUntil("wait-until-scheduled-time", new Date(target));

    return step.run("publish", async () => {
      const admin = createAdminClient();
      const { data: post } = await admin
        .from("posts")
        .select("status, scheduled_at")
        .eq("id", postId)
        .eq("user_id", userId)
        .maybeSingle();

      const stillScheduled =
        post?.status === "scheduled" &&
        post.scheduled_at !== null &&
        new Date(post.scheduled_at).getTime() === target;
      if (!stillScheduled) return { skipped: "The post was cancelled, rescheduled or deleted." };

      return publishPost(postId, userId);
    });
  }
);

export const functions = [publishScheduledPost];
