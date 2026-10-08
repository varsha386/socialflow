import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Composer, type ComposerInitial } from "@/components/composer/composer";
import { PageHeader } from "@/components/page-header";
import { isValidDate } from "@/lib/calendar";
import { getCurrentUser, getDraft, getSocialAccounts } from "@/lib/data";

export const metadata: Metadata = { title: "Create post" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// /create starts a new post; /create?post=<id> reopens a saved draft;
// /create?date=YYYY-MM-DD (from the calendar) starts one with Schedule set to that day.
export default async function CreatePostPage({ searchParams }: PageProps<"/create">) {
  const { post, date } = await searchParams;
  const suggestedDate = typeof date === "string" && isValidDate(date) ? date : undefined;
  const postId = typeof post === "string" && UUID.test(post) ? post : null;

  const [user, allAccounts, draft] = await Promise.all([
    getCurrentUser(),
    getSocialAccounts(),
    postId ? getDraft(postId) : null,
  ]);
  if (postId && !draft) notFound();

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
        title={draft ? "Edit draft" : "Create post"}
        description="Write once, then publish or schedule it everywhere."
      />
      {/* key: start fresh when switching between drafts */}
      <Composer
        key={initial.postId ?? "new"}
        userId={user.id}
        timezone={user.timezone}
        accounts={accounts}
        initial={initial}
        suggestedDate={suggestedDate}
      />
    </>
  );
}
