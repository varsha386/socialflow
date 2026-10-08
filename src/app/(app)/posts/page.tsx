import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Pencil, Play, SquarePen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PlatformBadge } from "@/components/platform-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser, getPosts } from "@/lib/data";
import { PLATFORMS } from "@/lib/platforms";
import type { PostStatus } from "@/lib/types";
import { DeleteDraftButton } from "./delete-draft-button";

export const metadata: Metadata = { title: "Posts" };

const STATUS: Record<PostStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "outline" },
  scheduled: { label: "Scheduled", variant: "secondary" },
  publishing: { label: "Publishing", variant: "secondary" },
  published: { label: "Published", variant: "default" },
  partially_published: { label: "Partly published", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
};

export default async function PostsPage() {
  const [user, posts] = await Promise.all([getCurrentUser(), getPosts()]);
  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: user.timezone }).format(
      new Date(iso)
    );

  return (
    <>
      <PageHeader title="Posts" description="Drafts, scheduled, and published posts.">
        <Link href="/create" className={buttonVariants({ size: "lg" })}>
          <SquarePen />
          Create post
        </Link>
      </PageHeader>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed bg-card px-6 py-16 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <FileText className="size-6" />
          </span>
          <h2 className="font-medium">Write your first post</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Drafts you save, and posts you schedule or publish, will show up here.
          </p>
        </div>
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {posts.map((post) => {
              const status = STATUS[post.status];
              const when =
                post.status === "scheduled" && post.scheduledAt
                  ? `Goes out ${formatDate(post.scheduledAt)}`
                  : post.publishedAt
                    ? `Published ${formatDate(post.publishedAt)}`
                    : `Edited ${formatDate(post.updatedAt)}`;

              return (
                <li key={post.id} className="flex items-center gap-4 px-4 py-3">
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

                  {post.status === "draft" && (
                    <div className="flex items-center">
                      <Link
                        href={`/create?post=${post.id}`}
                        className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label="Edit draft"
                        title="Edit draft"
                      >
                        <Pencil className="size-4" />
                      </Link>
                      <DeleteDraftButton postId={post.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
