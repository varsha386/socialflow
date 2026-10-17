import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Composer, type ComposerInitial } from "@/components/composer/composer";
import { PageHeader } from "@/components/page-header";
import { isValidDate } from "@/lib/calendar";
import {
  getBestTimeSuggestions,
  getCurrentUser,
  getDraft,
  getNextFreeSlot,
  getQueueSlots,
  getSocialAccounts,
} from "@/lib/data";

export const metadata: Metadata = { title: "Create post" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// /create starts a new post; /create?post=<id> reopens a saved draft;
// /create?from=<id> ("Post again") starts a new post copied from any earlier post;
// /create?date=YYYY-MM-DD (from the calendar) starts one with Schedule set to that day.
export default async function CreatePostPage({ searchParams }: PageProps<"/create">) {
  const { post, from, date } = await searchParams;
  const suggestedDate = typeof date === "string" && isValidDate(date) ? date : undefined;
  const postId = typeof post === "string" && UUID.test(post) ? post : null;
  const fromId = !postId && typeof from === "string" && UUID.test(from) ? from : null;

  const [user, allAccounts, draft, original, queueSlots] = await Promise.all([
    getCurrentUser(),
    getSocialAccounts(),
    postId ? getDraft(postId) : null,
    fromId ? getDraft(fromId) : null,
    getQueueSlots(),
  ]);
  if ((postId && !draft) || (fromId && !original)) notFound();

  // Written out here (not in the browser) so the server and browser show the same text.
  const [nextSlot, bestTimes] = await Promise.all([
    getNextFreeSlot(user.timezone, queueSlots),
    getBestTimeSuggestions(user.timezone),
  ]);
  const format = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en", { ...options, timeZone: user.timezone }).format(date);
  const queue = {
    hasTimes: queueSlots.length > 0,
    next: nextSlot
      ? format(nextSlot, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
      : null,
  };
  const accounts = allAccounts.filter((a) => a.status === "connected");
  const initial: ComposerInitial = draft
    ? {
        postId: draft.id,
        caption: draft.caption,
        media: draft.media,
        accountIds: draft.accountIds,
        customCaptions: draft.customCaptions,
        youtube: draft.youtube,
      }
    : original
      ? {
          // No postId: saving creates a new post and leaves the original untouched.
          // The media files are shared with the original, not uploaded again.
          postId: null,
          caption: original.caption,
          media: original.media,
          // Skip accounts that were disconnected since, or need reconnecting.
          accountIds: original.accountIds.filter((id) => accounts.some((a) => a.id === id)),
          customCaptions: original.customCaptions,
          youtube: original.youtube,
        }
      : {
          postId: null,
          caption: "",
          media: [],
          // New posts start with every connected account chosen.
          accountIds: accounts.map((a) => a.id),
          customCaptions: {},
          youtube: { title: "", privacy: "public" },
        };

  return (
    <>
      <PageHeader
        title={draft ? "Edit draft" : original ? "Post again" : "Create post"}
        description={
          original
            ? "A copy of your earlier post. Change anything you like, then publish or schedule it as a new post."
            : "Write once, then publish or schedule it everywhere."
        }
      />
      {/* key: start fresh when switching between drafts or copies */}
      <Composer
        key={initial.postId ?? (fromId ? `copy-${fromId}` : "new")}
        userId={user.id}
        timezone={user.timezone}
        accounts={accounts}
        initial={initial}
        suggestedDate={suggestedDate}
        queue={queue}
        bestTimes={bestTimes}
      />
    </>
  );
}
