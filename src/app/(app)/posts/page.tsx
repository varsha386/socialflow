import type { Metadata } from "next";
import Link from "next/link";
import { Copy, FileText, Pencil, Play, SquarePen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PlatformBadge } from "@/components/platform-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { POST_TABS, getCurrentUser, getPostCounts, getPosts, type PostTab } from "@/lib/data";
import { PLATFORMS } from "@/lib/platforms";
import type { PostStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DeleteDraftButton } from "./delete-draft-button";
import { SelectablePostList } from "./delete-posts";

export const metadata: Metadata = { title: "Posts" };

const STATUS: Record<PostStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "outline" },
  scheduled: { label: "Scheduled", variant: "secondary" },
  publishing: { label: "Publishing", variant: "secondary" },
  published: { label: "Published", variant: "default" },
  partially_published: { label: "Partly published", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
};

// What each tab says when it has no posts.
const EMPTY: Record<PostTab, { title: string; text: string }> = {
  all: { title: "Write your first post", text: "Drafts you save, and posts you schedule or publish, will show up here." },
  draft: { title: "No drafts", text: "Posts you save without publishing or scheduling show up here." },
  scheduled: { title: "Nothing scheduled", text: "Posts waiting to go out at a set time, or in your queue, show up here." },
  published: { title: "Nothing published yet", text: "Posts that went out to all their accounts show up here." },
  failed: { title: "No failed posts", text: "Posts that couldn't go out to one or more accounts show up here, ready to retry." },
};

export default async function PostsPage({ searchParams }: PageProps<"/posts">) {
  const { status } = await searchParams;
  const tab: PostTab = typeof status === "string" && status in POST_TABS ? (status as PostTab) : "all";
  const [user, posts, counts] = await Promise.all([getCurrentUser(), getPosts(tab), getPostCounts()]);
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: user.timezone }).format(
      new Date(iso)
    );

  return (
    <>
      <PageHeader title="Posts" description="Drafts, scheduled, published and failed posts.">
        <Link href="/create" className={buttonVariants({ size: "lg" })}>
          <SquarePen />
          Create post
        </Link>
      </PageHeader>

      {/* Each tab has its own address (/posts?status=…), so Back, bookmarks and links work. */}
      <nav aria-label="Post status" className="mb-6 flex flex-wrap gap-1">
        {(Object.keys(POST_TABS) as PostTab[]).map((id) => {
          const active = tab === id;
          const alert = id === "failed" && counts.failed > 0;
          return (
            <Link
              key={id}
              href={id === "all" ? "/posts" : `/posts?status=${id}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
                active
                  ? "bg-primary font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {POST_TABS[id].label}
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums",
                  alert ? "bg-destructive font-semibold text-white" : active ? "bg-primary-foreground/20" : "bg-muted"
                )}
              >
                {counts[id]}
              </span>
            </Link>
          );
        })}
      </nav>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed bg-card px-6 py-16 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <FileText className="size-6" />
          </span>
          <h2 className="font-medium">{EMPTY[tab].title}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{EMPTY[tab].text}</p>
        </div>
      ) : (
        <SelectablePostList
          items={posts.map((post) => {
              const status = STATUS[post.status];
              const when =
                post.status === "scheduled" && post.scheduledAt
                  ? `Goes out ${formatDate(post.scheduledAt)}`
                  : post.publishedAt
                    ? `Published ${formatDate(post.publishedAt)}`
                    : `Edited ${formatDate(post.updatedAt)}`;

              const row = (
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {post.thumbnail?.kind === "image" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.thumbnail.url} alt="" className="size-full object-cover" />
                    )}
                    {post.thumbnail?.kind === "video" && (
                      <>
                        <video src={post.thumbnail.url} muted preload="metadata" className="size-full object-cover" />
                        <Play className="absolute top-1/2 left-1/2 size-5 -translate-1/2 fill-white text-white" />
                      </>
                    )}
                    {!post.thumbnail && <FileText className="absolute top-1/2 left-1/2 size-5 -translate-1/2 text-muted-foreground" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link href={`/posts/${post.id}`} className="block truncate text-sm font-medium hover:underline">
                      {post.caption || <span className="text-muted-foreground">No caption</span>}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <span>{when}</span>
                      {post.mediaCount > 1 && <span>· {post.mediaCount} files</span>}
                    </div>
                  </div>

                  <div className="hidden items-center sm:flex">
                    {post.platforms.map((id) => (
                      <span key={id} className="-ml-2 scale-75 rounded-2xl ring-2 ring-card">
                        <PlatformBadge platform={PLATFORMS.find((p) => p.id === id)!} />
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center">
                    <Link
                      href={`/create?from=${post.id}`}
                      className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={post.status === "draft" ? "Duplicate" : "Post again"}
                      title={post.status === "draft" ? "Duplicate" : "Post again"}
                    >
                      <Copy className="size-4" />
                    </Link>
                    {post.status === "draft" && (
                      <>
                        <Link
                          href={`/create?post=${post.id}`}
                          className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Edit draft"
                          title="Edit draft"
                        >
                          <Pencil className="size-4" />
                        </Link>
                        <DeleteDraftButton postId={post.id} />
                      </>
                    )}
                  </div>
                </div>
              );
              const isLive = post.status === "published" || post.status === "partially_published";
              return {
                id: post.id,
                // Scheduled or publishing posts must have their schedule cancelled first.
                deletable: post.status !== "scheduled" && post.status !== "publishing",
                live: isLive
                  ? post.platforms.map((id) => ({ account: PLATFORMS.find((p) => p.id === id)?.name ?? id, platform: "" }))
                  : [],
                row,
              };
            })}
        />
      )}
    </>
  );
}
