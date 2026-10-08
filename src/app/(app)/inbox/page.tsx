import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Inbox, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PlatformBadge } from "@/components/platform-badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCurrentUser, getInbox, type InboxComment } from "@/lib/data";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { RefreshInboxButton, ReplyBox } from "./inbox-parts";

export const metadata: Metadata = { title: "Inbox" };

// /inbox?show=needs-reply&platform=instagram
export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const params = await searchParams;
  const [user, { threads, lastSynced }] = await Promise.all([getCurrentUser(), getInbox()]);

  const show = params.show === "needs-reply" ? "needs-reply" : "all";
  const platform = PLATFORMS.some((p) => p.id === params.platform) ? (params.platform as PlatformId) : null;
  const needsReplyCount = threads.filter((t) => t.needsReply).length;
  const visible = threads.filter(
    (t) => (show === "all" || t.needsReply) && (!platform || t.platform === platform)
  );

  const when = (iso: string) =>
    new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: user.timezone }).format(
      new Date(iso)
    );
  const link = (next: { show?: string; platform?: string | null }) => {
    const q = new URLSearchParams();
    const s = next.show ?? show;
    const p = next.platform === undefined ? platform : next.platform;
    if (s !== "all") q.set("show", s);
    if (p) q.set("platform", p);
    return `/inbox${q.size ? `?${q}` : ""}`;
  };
  const pill = (active: boolean) =>
    cn(
      "rounded-full px-3.5 py-1.5 text-sm transition-colors",
      active ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border hover:text-foreground"
    );

  return (
    <>
      <PageHeader
        title="Inbox"
        description={`Comments on your posts from the last 30 days.${lastSynced ? ` Checked ${when(lastSynced)}.` : ""}`}
      >
        <RefreshInboxButton />
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link href={link({ show: "all" })} className={pill(show === "all")}>
          All
        </Link>
        <Link href={link({ show: "needs-reply" })} className={pill(show === "needs-reply")}>
          Needs reply{needsReplyCount > 0 && ` (${needsReplyCount})`}
        </Link>
        <span className="mx-1 h-5 w-px bg-border" />
        <Link href={link({ platform: null })} className={pill(!platform)}>
          All platforms
        </Link>
        {PLATFORMS.map((p) => (
          <Link key={p.id} href={link({ platform: p.id })} className={pill(platform === p.id)}>
            {p.name}
          </Link>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed bg-card px-6 py-16 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Inbox className="size-6" />
          </span>
          <h2 className="font-medium">
            {threads.length === 0 ? "No comments yet" : show === "needs-reply" ? "You're all caught up" : "Nothing here"}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {threads.length === 0
              ? "Comments on posts you publish with SocialFlow will appear here. Click Refresh to check now."
              : "No comments match these filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((thread) => {
            const info = PLATFORMS.find((p) => p.id === thread.platform)!;
            return (
              <Card key={thread.id} className={cn("gap-0 py-0", thread.needsReply && "ring-primary/40")}>
                <div className="flex items-center gap-3 border-b px-4 py-2.5 text-xs text-muted-foreground">
                  <span className="scale-75">
                    <PlatformBadge platform={info} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    On{" "}
                    <Link href={`/posts/${thread.postId}`} className="font-medium text-foreground hover:underline">
                      {thread.postCaption.slice(0, 80) || "your post"}
                    </Link>{" "}
                    · {thread.accountName}
                  </span>
                  {thread.needsReply && (
                    <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
                      Needs reply
                    </span>
                  )}
                  {thread.postUrl && (
                    <a
                      href={thread.postUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-foreground"
                      aria-label={`View on ${info.name}`}
                      title={`View on ${info.name}`}
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                </div>

                <div className="space-y-3 p-4">
                  <CommentView comment={thread} when={when} />
                  {thread.replies.length > 0 && (
                    <div className="ml-5 space-y-3 border-l-2 pl-4">
                      {thread.replies.map((r) => (
                        <CommentView key={r.id} comment={r} when={when} />
                      ))}
                    </div>
                  )}
                  <div className="ml-11">
                    <ReplyBox commentId={thread.id} replyingTo={thread.author ?? "this comment"} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <MessageCircle className="size-3.5" />
        New comments are collected every 30 minutes. Direct messages aren&apos;t included.
      </p>
    </>
  );
}

function CommentView({ comment, when }: { comment: InboxComment; when: (iso: string) => string }) {
  const name = comment.author ?? "Someone";
  return (
    <div className="flex gap-3">
      {comment.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={comment.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="size-8 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-sm">
          <span className="font-medium">{name}</span>
          {comment.isOwn && (
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">You</span>
          )}
          <span className="ml-2 text-xs text-muted-foreground">{when(comment.createdAt)}</span>
        </p>
        <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">{comment.text}</p>
      </div>
    </div>
  );
}
