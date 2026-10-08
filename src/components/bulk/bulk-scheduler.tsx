"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CircleCheck, CircleX, LoaderCircle, Play, TriangleAlert, X } from "lucide-react";
import { saveDraft, schedulePost } from "@/app/(app)/create/actions";
import { MediaUploader } from "@/components/composer/media-uploader";
import { PlatformBadge } from "@/components/platform-badge";
import { TimezoneWarning } from "@/components/timezone-warning";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { addDays } from "@/lib/calendar";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { checkPost, YOUTUBE_TITLE_LIMIT, type MediaItem, type YouTubeOptions } from "@/lib/post-rules";
import { utcToZonedInput, zonedTimeToUtc } from "@/lib/timezone";
import type { SocialAccount } from "@/lib/types";

const MAX_FILES = 30;
const platformInfo = (id: PlatformId) => PLATFORMS.find((p) => p.id === id)!;

type RowResult = { state: "working" } | { state: "done"; postId: string } | { state: "error"; message: string };

// Tomorrow at 9:00 AM in the given time zone, as "2026-10-15T09:00".
function tomorrowAtNine(timeZone: string) {
  return `${utcToZonedInput(new Date(Date.now() + 24 * 60 * 60 * 1000), timeZone).slice(0, 10)}T09:00`;
}

// The time for the post at `index`: the start time plus `index` steps.
// Day steps keep the same clock time (even across daylight-saving changes).
function spreadTime(start: string, index: number, every: number, unit: "hours" | "days", timeZone: string) {
  if (!start) return "";
  if (unit === "days") return `${addDays(start.slice(0, 10), index * every)}T${start.slice(11, 16)}`;
  const base = zonedTimeToUtc(start, timeZone);
  if (!base) return "";
  return utcToZonedInput(new Date(base.getTime() + index * every * 60 * 60 * 1000), timeZone);
}

export function BulkScheduler({
  userId,
  timezone,
  accounts,
}: {
  userId: string;
  timezone: string;
  accounts: SocialAccount[];
}) {
  const [selected, setSelected] = useState<string[]>(accounts.map((a) => a.id));
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [caption, setCaption] = useState("");
  const [captions, setCaptions] = useState<Record<string, string>>({}); // per-post overrides
  const [titles, setTitles] = useState<Record<string, string>>({}); // YouTube titles
  const [times, setTimes] = useState<Record<string, string>>({}); // per-post time overrides
  const [privacy, setPrivacy] = useState<YouTubeOptions["privacy"]>("public");
  const [start, setStart] = useState(() => tomorrowAtNine(timezone));
  const [every, setEvery] = useState(1);
  const [unit, setUnit] = useState<"hours" | "days">("days");
  const [results, setResults] = useState<Record<string, RowResult>>({});
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const chosenAccounts = accounts.filter((a) => selected.includes(a.id));

  // Everything needed to create each post, plus anything that would stop it.
  const rows = useMemo(
    () =>
      media.map((item, index) => {
        const postCaption = captions[item.id] ?? caption;
        const youtube: YouTubeOptions = {
          title: titles[item.id] ?? postCaption.split("\n")[0].slice(0, YOUTUBE_TITLE_LIMIT),
          privacy,
        };
        // YouTube only takes videos, so photos quietly skip YouTube accounts.
        const targets = chosenAccounts.filter((a) => a.platform !== "youtube" || item.kind === "video");
        const platforms = [...new Set(targets.map((a) => a.platform))];
        const time = times[item.id] ?? spreadTime(start, index, every, unit, timezone);
        const problems = platforms.flatMap((p) =>
          checkPost(p, postCaption, [item], youtube).map((msg) => `${platformInfo(p).name}: ${msg}`)
        );
        if (targets.length === 0) problems.push("No account can take this file.");
        if (!time) problems.push("Choose a time.");
        return { item, caption: postCaption, youtube, targets, platforms, time, problems };
      }),
    [media, captions, caption, titles, privacy, chosenAccounts, times, start, every, unit, timezone]
  );

  const pending = rows.filter((r) => results[r.item.id]?.state !== "done");
  const blocked = pending.filter((r) => r.problems.length > 0);
  const allDone = rows.length > 0 && pending.length === 0;

  function removeRow(id: string) {
    setMedia((m) => m.filter((x) => x.id !== id));
    setResults((r) => {
      const next = { ...r };
      delete next[id];
      return next;
    });
  }

  async function run(mode: "schedule" | "draft") {
    setMessage(null);
    if (pending.length === 0) return;
    if (mode === "schedule" && blocked.length > 0) {
      setMessage(`Fix the ${blocked.length === 1 ? "post" : `${blocked.length} posts`} marked below first.`);
      return;
    }
    setRunning(true);
    // One at a time, so the results appear in order and nothing is overloaded.
    for (const row of pending) {
      const id = row.item.id;
      setResults((r) => ({ ...r, [id]: { state: "working" } }));
      const saved = await saveDraft({
        postId: null,
        caption: row.caption,
        mediaIds: [id],
        accountIds: row.targets.map((a) => a.id),
        customCaptions: {},
        youtube: row.youtube,
      });
      if (!saved.postId || saved.error) {
        setResults((r) => ({ ...r, [id]: { state: "error", message: saved.error ?? "Couldn't save." } }));
        continue;
      }
      if (mode === "schedule") {
        const scheduled = await schedulePost(saved.postId, row.time);
        if (scheduled.error) {
          setResults((r) => ({ ...r, [id]: { state: "error", message: `Saved as a draft, but: ${scheduled.error}` } }));
          continue;
        }
      }
      setResults((r) => ({ ...r, [id]: { state: "done", postId: saved.postId! } }));
    }
    setRunning(false);
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="font-medium">Connect an account first</p>
          <Link href="/connections" className={buttonVariants({ className: "mt-4" })}>
            Go to Connections
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Post to</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {accounts.map((a) => {
            const on = selected.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                disabled={running}
                aria-pressed={on}
                onClick={() => setSelected((s) => (on ? s.filter((x) => x !== a.id) : [...s, a.id]))}
                className={cn(
                  "flex items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm transition-colors",
                  on ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground hover:border-primary/40"
                )}
              >
                <span className={cn("scale-75", !on && "opacity-50 grayscale")}>
                  <PlatformBadge platform={platformInfo(a.platform)} />
                </span>
                <span className="max-w-40 truncate">{a.display_name ?? a.username}</span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Photos and videos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <MediaUploader
            userId={userId}
            media={media}
            onChange={(update) => setMedia((m) => update(m).slice(0, MAX_FILES))}
          />
          <p className="text-xs text-muted-foreground">
            Each file becomes its own post (up to {MAX_FILES}). Photos skip YouTube, which only takes videos.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Caption and timing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="bulk-caption">Caption for all posts</Label>
            <textarea
              id="bulk-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              placeholder="You can change any single post's caption below."
              className="w-full rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="bulk-start">First post</Label>
              <Input
                id="bulk-start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-11 w-auto bg-card"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-every">Then one every</Label>
              <div className="flex gap-2">
                <Input
                  id="bulk-every"
                  type="number"
                  min={1}
                  max={unit === "days" ? 30 : 72}
                  value={every}
                  onChange={(e) => setEvery(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                  className="h-11 w-20 bg-card"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as "hours" | "days")}
                  aria-label="Unit"
                  className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm"
                >
                  <option value="days">{every === 1 ? "day" : "days"}</option>
                  <option value="hours">{every === 1 ? "hour" : "hours"}</option>
                </select>
              </div>
            </div>
            {chosenAccounts.some((a) => a.platform === "youtube") && (
              <div className="space-y-2">
                <Label htmlFor="bulk-privacy">YouTube visibility</Label>
                <select
                  id="bulk-privacy"
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value as YouTubeOptions["privacy"])}
                  className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm"
                >
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
              </div>
            )}
            {Object.keys(times).length > 0 && (
              <button
                type="button"
                onClick={() => setTimes({})}
                className="h-11 text-sm font-medium text-primary hover:underline"
              >
                Reset times you changed
              </button>
            )}
          </div>
          <TimezoneWarning timezone={timezone} />
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card className="gap-0 pb-0">
          <CardHeader className="pb-4">
            <CardTitle>4. Review ({rows.length} {rows.length === 1 ? "post" : "posts"})</CardTitle>
          </CardHeader>
          <ul className="divide-y border-t">
            {rows.map((row, index) => {
              const result = results[row.item.id];
              const done = result?.state === "done";
              return (
                <li key={row.item.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row", done && "opacity-70")}>
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {row.item.kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.item.url} alt="" className="size-full object-cover" />
                    ) : (
                      <>
                        <video src={row.item.url} muted preload="metadata" className="size-full object-cover" />
                        <Play className="absolute top-1/2 left-1/2 size-5 -translate-1/2 fill-white text-white" />
                      </>
                    )}
                    <span className="absolute top-1 left-1 rounded-full bg-black/60 px-1.5 text-xs text-white">
                      {index + 1}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <textarea
                      value={captions[row.item.id] ?? ""}
                      onChange={(e) => setCaptions((c) => ({ ...c, [row.item.id]: e.target.value }))}
                      placeholder={caption ? `Uses the caption for all: "${caption.slice(0, 60)}${caption.length > 60 ? "…" : ""}"` : "Caption for this post"}
                      rows={2}
                      disabled={done || running}
                      className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:border-ring"
                    />
                    {row.item.kind === "video" && row.platforms.includes("youtube") && (
                      <Input
                        value={titles[row.item.id] ?? ""}
                        onChange={(e) => setTitles((t) => ({ ...t, [row.item.id]: e.target.value }))}
                        placeholder={`YouTube title (default: "${row.youtube.title || "first line of the caption"}")`}
                        disabled={done || running}
                        className="h-9 bg-card"
                      />
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {row.platforms.map((p) => (
                        <span key={p} className="rounded-full bg-muted px-2 py-0.5">
                          {platformInfo(p).name}
                        </span>
                      ))}
                      {row.item.kind === "image" && chosenAccounts.some((a) => a.platform === "youtube") && (
                        <span>· skips YouTube (photo)</span>
                      )}
                    </div>
                    {row.problems.length > 0 && !done && (
                      <p className="flex items-start gap-1.5 text-xs text-amber-700">
                        <TriangleAlert className="mt-px size-3.5 shrink-0" />
                        {row.problems.join(" ")}
                      </p>
                    )}
                    {result?.state === "error" && (
                      <p className="flex items-start gap-1.5 text-xs text-destructive">
                        <CircleX className="mt-px size-3.5 shrink-0" />
                        {result.message}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-start gap-2 sm:flex-col sm:items-end">
                    <Input
                      type="datetime-local"
                      value={row.time}
                      onChange={(e) => setTimes((t) => ({ ...t, [row.item.id]: e.target.value }))}
                      disabled={done || running}
                      aria-label={`Time for post ${index + 1}`}
                      className={cn("h-9 w-auto bg-card", times[row.item.id] && "border-primary")}
                    />
                    {result?.state === "working" && (
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" /> Working
                      </span>
                    )}
                    {done && (
                      <Link
                        href={`/posts/${result.postId}`}
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <CircleCheck className="size-4" /> Done
                      </Link>
                    )}
                    {!result && !running && (
                      <button
                        type="button"
                        onClick={() => removeRow(row.item.id)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3.5" /> Remove
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {allDone ? (
            <>
              <Link href="/calendar" className={buttonVariants({ size: "lg" })}>
                See them in the calendar
              </Link>
              <Link href="/posts" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Go to Posts
              </Link>
            </>
          ) : (
            <>
              <Button size="lg" className="h-11 px-6" onClick={() => run("schedule")} disabled={running}>
                {running && <LoaderCircle className="animate-spin" />}
                Schedule {pending.length} {pending.length === 1 ? "post" : "posts"}
              </Button>
              <Button size="lg" variant="outline" className="h-11 px-6" onClick={() => run("draft")} disabled={running}>
                Save as drafts
              </Button>
            </>
          )}
          {message && <span className="text-sm text-destructive">{message}</span>}
        </div>
      )}
    </div>
  );
}
