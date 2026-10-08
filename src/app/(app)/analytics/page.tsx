import type { Metadata } from "next";
import Link from "next/link";
import { ChartColumn, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PlatformBadge } from "@/components/platform-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getAnalytics, getCurrentUser } from "@/lib/data";
import { PLATFORMS } from "@/lib/platforms";
import { EngagementChart, RefreshButton } from "./engagement-chart";

export const metadata: Metadata = { title: "Analytics" };

const fmt = (n: number) => n.toLocaleString("en");

export default async function AnalyticsPage() {
  const user = await getCurrentUser();
  const data = await getAnalytics(user.timezone);
  const updated = data.lastRefreshed
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: user.timezone }).format(
        new Date(data.lastRefreshed)
      )
    : null;

  const tiles = [
    { label: "Posts published", value: fmt(data.totals.posts) },
    { label: "Likes", value: fmt(data.totals.likes) },
    { label: "Comments", value: fmt(data.totals.comments) },
    data.hasViews
      ? { label: "YouTube views", value: fmt(data.totals.views) }
      : { label: "Shares", value: fmt(data.totals.shares) },
  ];

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Last 30 days. ${updated ? `Numbers updated ${updated}.` : "Numbers haven't been collected yet."} They refresh every 6 hours.`}
      >
        <RefreshButton />
      </PageHeader>

      {data.totals.posts === 0 && data.accounts.every((a) => a.followers === null) ? (
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed bg-card px-6 py-16 text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <ChartColumn className="size-6" />
          </span>
          <h2 className="font-medium">No numbers yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Publish a post, then click Refresh now to collect likes, comments and followers from your accounts.
          </p>
          <Link href="/create" className={buttonVariants({ className: "mt-4" })}>
            Create post
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {tiles.map((t) => (
              <Card key={t.label}>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{t.label}</p>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">{t.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card>
              <CardHeader>
                <CardTitle>Engagement by day</CardTitle>
                <CardDescription>Likes, comments and shares on posts published each day.</CardDescription>
              </CardHeader>
              <CardContent>
                <EngagementChart days={data.days} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Followers</CardTitle>
                <CardDescription>Change over the last 30 days.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {data.accounts.map((a) => (
                    <li key={a.id} className="flex items-center gap-3">
                      <span className="scale-90">
                        <PlatformBadge platform={PLATFORMS.find((p) => p.id === a.platform)!} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
                      <span className="text-right">
                        <span className="block font-semibold tabular-nums">
                          {a.followers === null ? "–" : fmt(a.followers)}
                        </span>
                        {a.change !== null && a.change !== 0 && (
                          <span className="block text-xs text-muted-foreground tabular-nums">
                            {a.change > 0 ? "▲" : "▼"} {fmt(Math.abs(a.change))}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted-foreground">
                  Growth appears once SocialFlow has collected counts on two different days.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="gap-0 pb-0">
            <CardHeader className="pb-4">
              <CardTitle>Top posts</CardTitle>
            </CardHeader>
            {data.topPosts.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No posts published in the last 30 days.</p>
            ) : (
              <div className="overflow-x-auto border-t">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr className="border-b">
                      <th className="px-6 py-2 font-medium">Post</th>
                      {data.hasViews && <th className="px-3 py-2 text-right font-medium">Views</th>}
                      <th className="px-3 py-2 text-right font-medium">Likes</th>
                      <th className="px-3 py-2 text-right font-medium">Comments</th>
                      <th className="px-3 py-2 text-right font-medium">Shares</th>
                      <th className="px-6 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y tabular-nums">
                    {data.topPosts.map((p, i) => (
                      <tr key={`${p.postId}-${p.platform}-${i}`}>
                        <td className="max-w-0 px-6 py-3">
                          <Link href={`/posts/${p.postId}`} className="block truncate font-medium hover:underline">
                            {p.caption || "No caption"}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {PLATFORMS.find((x) => x.id === p.platform)?.name} · {p.accountName}
                          </span>
                        </td>
                        {data.hasViews && <td className="px-3 py-3 text-right">{p.views === null ? "–" : fmt(p.views)}</td>}
                        <td className="px-3 py-3 text-right">{fmt(p.likes)}</td>
                        <td className="px-3 py-3 text-right">{fmt(p.comments)}</td>
                        <td className={cn("px-3 py-3 text-right", p.platform !== "facebook" && "text-muted-foreground")}>
                          {p.platform === "facebook" ? fmt(p.shares) : "–"}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {p.url && (
                            <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex text-muted-foreground hover:text-foreground" aria-label="View on the platform">
                              <ExternalLink className="size-4" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <p className="text-xs text-muted-foreground">
            Views for Instagram and Facebook need an extra permission from Meta, so only YouTube views are shown for now.
          </p>
        </div>
      )}
    </>
  );
}
