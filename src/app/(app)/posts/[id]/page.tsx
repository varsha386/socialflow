import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, CircleX, Clock, ExternalLink, LoaderCircle, Pencil, Play } from "lucide-react";
import { PlatformBadge } from "@/components/platform-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser, getPostDetail, type PostTargetDetail } from "@/lib/data";
import { PLATFORMS } from "@/lib/platforms";
import { AutoRefresh, RetryButton } from "./post-actions";

export const metadata: Metadata = { title: "Post" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HEADLINES = {
  draft: "Draft",
  scheduled: "Scheduled",
  publishing: "Publishing…",
  published: "Published everywhere",
  partially_published: "Published, but some accounts failed",
  failed: "Couldn't publish",
} as const;

export default async function PostDetailPage({ params }: PageProps<"/posts/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [user, post] = await Promise.all([getCurrentUser(), getPostDetail(id)]);
  if (!post) notFound();

  const format = (iso: string) =>
    new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: user.timezone }).format(
      new Date(iso)
    );
  const anyFailed = post.targets.some((t) => t.status === "failed");
  const canRetry = anyFailed && (post.status === "failed" || post.status === "partially_published");

  return (
    <>
      {post.status === "publishing" && <AutoRefresh />}

      <Link href="/posts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        All posts
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{HEADLINES[post.status]}</h1>
          <p className="mt-1 text-muted-foreground">
            {post.publishedAt ? `Published ${format(post.publishedAt)}` : `Last edited ${format(post.updatedAt)}`}
          </p>
        </div>
        {post.status === "draft" && (
          <Link href={`/create?post=${post.id}`} className={buttonVariants({ size: "lg" })}>
            <Pencil />
            Edit draft
          </Link>
        )}
        {canRetry && <RetryButton postId={post.id} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {post.targets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts chosen yet.</p>
            ) : (
              <ul className="space-y-3">
                {post.targets.map((t) => (
                  <TargetRow key={t.id} target={t} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Post</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {post.media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {post.media.map((m, i) => (
                  <div key={i} className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                    {m.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" className="size-full object-cover" />
                    ) : (
                      <>
                        <video src={m.url} muted preload="metadata" className="size-full object-cover" />
                        <Play className="absolute top-1/2 left-1/2 size-5 -translate-1/2 fill-white text-white" />
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm break-words whitespace-pre-wrap">
              {post.caption || <span className="text-muted-foreground">No caption</span>}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function TargetRow({ target }: { target: PostTargetDetail }) {
  const platform = PLATFORMS.find((p) => p.id === target.platform)!;
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-muted p-3">
      <PlatformBadge platform={platform} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{target.accountName}</p>
        <p className="text-sm text-muted-foreground">{platform.name}</p>
        {target.status === "failed" && target.error && (
          <p className="mt-1 text-sm text-destructive">{target.error}</p>
        )}
        {target.status === "failed" && /reconnect/i.test(target.error ?? "") && (
          <Link href="/connections" className="mt-1 inline-block text-sm font-medium text-primary hover:underline">
            Go to Connections
          </Link>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
        {target.status === "published" && (
          <>
            <span className="flex items-center gap-1 text-primary">
              <CircleCheck className="size-4" /> Published
            </span>
            {target.url && (
              <a
                href={target.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                View post <ExternalLink className="size-3.5" />
              </a>
            )}
          </>
        )}
        {target.status === "failed" && (
          <span className="flex items-center gap-1 text-destructive">
            <CircleX className="size-4" /> Failed
          </span>
        )}
        {target.status === "publishing" && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Publishing
          </span>
        )}
        {target.status === "pending" && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-4" /> Not sent yet
          </span>
        )}
      </div>
    </li>
  );
}
