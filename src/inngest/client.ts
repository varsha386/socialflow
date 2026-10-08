import { Inngest } from "inngest";

// Inngest runs our background jobs, like publishing a post at its scheduled time.
// Locally, INNGEST_DEV=1 makes it use the Inngest Dev Server on your computer.
// On Vercel, the Inngest integration adds INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY.
export const inngest = new Inngest({ id: "socialflow" });

// Sent when a post is scheduled. `scheduledAt` is an ISO date string.
export const POST_SCHEDULED = "post/scheduled";
export type PostScheduledData = { postId: string; userId: string; scheduledAt: string };
