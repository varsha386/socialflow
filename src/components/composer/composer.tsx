"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CircleCheck, ListPlus, LoaderCircle, Send, TriangleAlert } from "lucide-react";
import { addToQueue, saveDraft, schedulePost } from "@/app/(app)/create/actions";
import { AiCaptionWriter } from "@/components/composer/ai-caption-writer";
import { CaptionEditor } from "@/components/composer/caption-editor";
import { MediaUploader } from "@/components/composer/media-uploader";
import { PostPreview } from "@/components/composer/post-preview";
import { PlatformBadge } from "@/components/platform-badge";
import { TimezoneWarning } from "@/components/timezone-warning";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import {
  CAPTION_LIMITS,
  INSTAGRAM_POSTS_PER_DAY,
  INSTAGRAM_STORY_MAX_SECONDS,
  YOUTUBE_TITLE_LIMIT,
  checkPost,
  type InstagramOptions,
  type MediaItem,
  type YouTubeOptions,
} from "@/lib/post-rules";
import { timeZoneLabel, utcToZonedInput } from "@/lib/timezone";
import type { SocialAccount } from "@/lib/types";

export type ComposerInitial = {
  postId: string | null;
  caption: string;
  media: MediaItem[];
  accountIds: string[];
  customCaptions: Partial<Record<PlatformId, string>>;
  youtube: YouTubeOptions;
  instagram: InstagramOptions;
};

// The posting queue, for the "Add to queue" button. `next` is the next free
// time, already written out in the user's time zone (e.g. "Mon 20 Oct, 9:00 AM").
export type ComposerQueue = { hasTimes: boolean; next: string | null };

// Suggested times for the Schedule panel. `local` is "2026-10-20T11:00" in the
// user's time zone; `personal` says whether they come from the user's own posts.
export type ComposerBestTimes = { personal: boolean; times: { label: string; local: string }[] };

const platformInfo = (id: PlatformId) => PLATFORMS.find((p) => p.id === id)!;

// Tomorrow at 9:00 AM in the given time zone, as "2026-10-15T09:00".
function suggestedScheduleTime(timeZone: string) {
  const tomorrow = utcToZonedInput(new Date(Date.now() + 24 * 60 * 60 * 1000), timeZone);
  return `${tomorrow.slice(0, 10)}T09:00`;
}

export function Composer({
  userId,
  timezone,
  accounts,
  initial,
  suggestedDate,
  queue,
  bestTimes,
  instagramPostsToday,
}: {
  userId: string;
  timezone: string;
  suggestedDate?: string; // "YYYY-MM-DD" from the calendar: start with Schedule open for that day
  accounts: SocialAccount[];
  initial: ComposerInitial;
  queue: ComposerQueue;
  bestTimes: ComposerBestTimes;
  instagramPostsToday: Record<string, number>; // account ID -> posts published in the last 24 hours
}) {
  const [postId, setPostId] = useState(initial.postId);
  const [selected, setSelected] = useState<string[]>(initial.accountIds);
  const [media, setMedia] = useState<MediaItem[]>(initial.media);
  const [caption, setCaption] = useState(initial.caption);
  const [customCaptions, setCustomCaptions] = useState(initial.customCaptions);
  const [youtube, setYoutube] = useState<YouTubeOptions>(initial.youtube);
  const [instagram, setInstagram] = useState<InstagramOptions>(initial.instagram);
  const [tab, setTab] = useState<"all" | PlatformId>("all");
  const [previewChoice, setPreviewChoice] = useState<PlatformId | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const [publishing, setPublishing] = useState(false);
  const [showSchedule, setShowSchedule] = useState(!!suggestedDate);
  const [scheduleAt, setScheduleAt] = useState(suggestedDate ? `${suggestedDate}T09:00` : ""); // "2026-10-15T19:00" in the user's time zone
  const router = useRouter();

  // The platforms of the chosen accounts, in a fixed order.
  const platforms = useMemo(() => {
    const chosen = new Set(accounts.filter((a) => selected.includes(a.id)).map((a) => a.platform));
    return PLATFORMS.map((p) => p.id).filter((id) => chosen.has(id));
  }, [accounts, selected]);

  const activeTab = tab !== "all" && !platforms.includes(tab) ? "all" : tab;
  const previewPlatform =
    previewChoice && platforms.includes(previewChoice) ? previewChoice : platforms[0] ?? null;

  const captionFor = (p: PlatformId) => customCaptions[p] ?? caption;
  // Instagram allows 100 posts per account in 24 hours: block when reached, warn when close.
  const instagramLimitNotes = accounts
    .filter((a) => a.platform === "instagram" && selected.includes(a.id))
    .flatMap((a) => {
      const used = instagramPostsToday[a.id] ?? 0;
      const name = a.username ? `@${a.username}` : (a.display_name ?? "This account");
      if (used >= INSTAGRAM_POSTS_PER_DAY) {
        return [`${name} has reached Instagram's ${INSTAGRAM_POSTS_PER_DAY} posts in 24 hours. Try again later.`];
      }
      if (used >= INSTAGRAM_POSTS_PER_DAY * 0.8) {
        return [`${name} can post ${INSTAGRAM_POSTS_PER_DAY - used} more times in the next 24 hours.`];
      }
      return [];
    });
  const checks = platforms.map((p) => ({
    platform: p,
    problems: [
      ...checkPost(p, captionFor(p), media, youtube, instagram),
      ...(p === "instagram" ? instagramLimitNotes.filter((n) => n.includes("has reached")) : []),
    ],
  }));

  function toggleAccount(id: string) {
    setMessage(null);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  // Saves the post as a draft. Returns its ID, or null if saving failed.
  async function save(): Promise<string | null> {
    const result = await saveDraft({
      postId,
      caption,
      mediaIds: media.map((m) => m.id),
      accountIds: selected,
      // Only send custom captions for platforms that are still chosen.
      customCaptions: Object.fromEntries(
        Object.entries(customCaptions).filter(([p]) => platforms.includes(p as PlatformId))
      ),
      youtube,
      instagram,
    });
    if (result.postId && result.postId !== postId) {
      setPostId(result.postId);
      // Put the draft's ID in the address (without reloading), so a refresh keeps editing it.
      window.history.replaceState(null, "", `/create?post=${result.postId}`);
    }
    if (result.error) {
      setMessage({ ok: false, text: result.error });
      return null;
    }
    return result.postId ?? null;
  }

  function handleSave() {
    setMessage(null);
    startSaving(async () => {
      if (await save()) setMessage({ ok: true, text: "Draft saved" });
    });
  }

  // Shows the first thing to fix before publishing or scheduling; true if there's nothing.
  function readyToSend(): boolean {
    setMessage(null);
    if (selected.length === 0) {
      setMessage({ ok: false, text: "Choose at least one account to post to." });
      return false;
    }
    const firstProblem = checks.find((c) => c.problems.length > 0);
    if (firstProblem) {
      setMessage({ ok: false, text: `Fix ${platformInfo(firstProblem.platform).name} first: ${firstProblem.problems[0]}` });
      return false;
    }
    return true;
  }

  function openSchedule() {
    if (!readyToSend()) return;
    // Suggest tomorrow at 9:00 AM in the user's time zone.
    if (!scheduleAt) setScheduleAt(suggestedScheduleTime(timezone));
    setShowSchedule(true);
  }

  function handleSchedule() {
    if (!readyToSend()) return;
    startSaving(async () => {
      const id = await save();
      if (!id) return;
      const result = await schedulePost(id, scheduleAt);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      router.push(`/posts/${id}`);
    });
  }

  function handleQueue() {
    if (!readyToSend()) return;
    startSaving(async () => {
      const id = await save();
      if (!id) return;
      const result = await addToQueue(id);
      if (result.error) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      router.push(`/posts/${id}`);
    });
  }

  function handlePublish() {
    if (!readyToSend()) return;
    if (!window.confirm(`Publish now to ${selected.length} ${selected.length === 1 ? "account" : "accounts"}?`)) return;

    setPublishing(true);
    startSaving(async () => {
      const id = await save();
      if (!id) {
        setPublishing(false);
        return;
      }
      try {
        const res = await fetch(`/api/posts/${id}/publish`, { method: "POST" });
        const body = (await res.json()) as { error?: string };
        if (body.error) {
          setMessage({ ok: false, text: body.error });
          setPublishing(false);
          return;
        }
      } catch {
        // The request may still be running on the server; the post page shows the latest status.
      }
      router.push(`/posts/${id}`);
    });
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="font-medium">Connect an account first</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You need at least one Instagram, Facebook or YouTube account to post to.
          </p>
          <Link href="/connections" className={buttonVariants({ className: "mt-4" })}>
            Go to Connections
          </Link>
        </CardContent>
      </Card>
    );
  }

  const previewAccount = previewPlatform
    ? accounts.find((a) => a.platform === previewPlatform && selected.includes(a.id))!
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {/* 1. Accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Post to</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {accounts.map((a) => {
              const on = selected.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAccount(a.id)}
                  aria-pressed={on}
                  className={cn(
                    "flex items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm transition-colors",
                    on
                      ? "border-primary bg-accent text-accent-foreground"
                      : "bg-card text-muted-foreground hover:border-primary/40"
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

        {/* 2. Media */}
        <Card>
          <CardHeader>
            <CardTitle>Photos and videos</CardTitle>
          </CardHeader>
          <CardContent>
            <MediaUploader
              userId={userId}
              media={media}
              onChange={(update) => {
                setMessage(null);
                setMedia(update);
              }}
            />
          </CardContent>
        </Card>

        {/* 3. Caption, with a tab per platform */}
        <Card>
          <CardHeader>
            <CardTitle>Caption</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {platforms.length > 0 && (
              <div className="flex flex-wrap gap-1" role="tablist">
                {(["all", ...platforms] as const).map((t) => {
                  const custom = t !== "all" && customCaptions[t] !== undefined;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === t}
                      onClick={() => setTab(t)}
                      className={cn(
                        "rounded-full px-3.5 py-1.5 text-sm transition-colors",
                        activeTab === t
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {t === "all" ? "All platforms" : platformInfo(t).name}
                      {custom && " •"}
                    </button>
                  );
                })}
              </div>
            )}

            {activeTab === "all" ? (
              <CaptionEditor
                value={caption}
                onChange={(v) => {
                  setMessage(null);
                  setCaption(v);
                }}
                placeholder="What do you want to share?"
                limits={platforms.map((p) => ({ label: platformInfo(p).name, max: CAPTION_LIMITS[p] }))}
              />
            ) : (
              <>
                <CaptionEditor
                  value={captionFor(activeTab)}
                  onChange={(v) => {
                    setMessage(null);
                    setCustomCaptions((c) => ({ ...c, [activeTab]: v }));
                  }}
                  placeholder={`Caption for ${platformInfo(activeTab).name}`}
                  limits={[{ label: platformInfo(activeTab).name, max: CAPTION_LIMITS[activeTab] }]}
                />
                <p className="text-xs text-muted-foreground">
                  {customCaptions[activeTab] !== undefined ? (
                    <>
                      {platformInfo(activeTab).name} uses its own caption.{" "}
                      <button
                        type="button"
                        className="font-medium text-primary hover:underline"
                        onClick={() =>
                          setCustomCaptions((c) => {
                            const next = { ...c };
                            delete next[activeTab];
                            return next;
                          })
                        }
                      >
                        Use the main caption instead
                      </button>
                    </>
                  ) : (
                    <>Start typing to give {platformInfo(activeTab).name} its own caption.</>
                  )}
                </p>
              </>
            )}

            <AiCaptionWriter
              platforms={activeTab === "all" ? platforms : [activeTab]}
              currentCaption={activeTab === "all" ? caption : captionFor(activeTab)}
              target={activeTab === "all" ? "the main caption" : `the ${platformInfo(activeTab).name} caption`}
              onUse={(text) => {
                setMessage(null);
                if (activeTab === "all") setCaption(text);
                else setCustomCaptions((c) => ({ ...c, [activeTab]: text }));
              }}
            />

            {activeTab === "youtube" || (activeTab === "all" && platforms.includes("youtube")) ? (
              <div className="grid gap-3 rounded-2xl bg-muted p-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="yt-title">YouTube title</Label>
                  <Input
                    id="yt-title"
                    value={youtube.title}
                    onChange={(e) => setYoutube((y) => ({ ...y, title: e.target.value }))}
                    placeholder="Give your video a title"
                    className="h-10 bg-card"
                  />
                  <p className={cn("text-xs text-muted-foreground", youtube.title.length > YOUTUBE_TITLE_LIMIT && "text-destructive")}>
                    {youtube.title.length}/{YOUTUBE_TITLE_LIMIT}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yt-privacy">Visibility</Label>
                  <select
                    id="yt-privacy"
                    value={youtube.privacy}
                    onChange={(e) => setYoutube((y) => ({ ...y, privacy: e.target.value as YouTubeOptions["privacy"] }))}
                    className="h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm"
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  The caption becomes the video description. Until Google verifies SocialFlow, YouTube keeps
                  uploaded videos private.
                </p>
              </div>
            ) : null}

            {activeTab === "instagram" || (activeTab === "all" && platforms.includes("instagram")) ? (
              <div className="space-y-2 rounded-2xl bg-muted p-4">
                <p className="text-sm font-medium" id="ig-format-label">
                  Instagram: post as
                </p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="ig-format-label">
                  {(
                    [
                      { value: "feed", label: "Feed post", hint: "Photo, carousel or Reel, with the caption" },
                      { value: "story", label: "Story", hint: "One photo or video, shown for 24 hours" },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={instagram.format === option.value}
                      onClick={() => {
                        setMessage(null);
                        setInstagram({ format: option.value });
                      }}
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                        instagram.format === option.value
                          ? "border-primary bg-card font-medium"
                          : "border-transparent bg-card/60 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {option.label}
                      <span className="block text-xs font-normal text-muted-foreground">{option.hint}</span>
                    </button>
                  ))}
                </div>
                {instagram.format === "story" && (
                  <p className="text-xs text-muted-foreground">
                    Stories don&apos;t show a caption, so Instagram gets only the photo or video. Tall photos and
                    videos (9:16) fill the screen best. Videos can be up to {INSTAGRAM_STORY_MAX_SECONDS} seconds.
                  </p>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* 4. Checks and save */}
        <Card>
          <CardContent className="space-y-4">
            {checks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Choose at least one account above.</p>
            ) : (
              <ul className="space-y-2">
                {checks.map(({ platform, problems }) => (
                  <li key={platform} className="flex items-start gap-2 text-sm">
                    {problems.length === 0 ? (
                      <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    ) : (
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    )}
                    <span>
                      <span className="font-medium">{platformInfo(platform).name}:</span>{" "}
                      {problems.length === 0 ? "ready" : problems.join(" ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {/* "Getting close" notes (the "reached" ones already show as problems above). */}
            {instagramLimitNotes
              .filter((n) => !n.includes("has reached"))
              .map((note) => (
                <p key={note} className="text-xs text-muted-foreground">
                  Instagram: {note}
                </p>
              ))}
            {platforms.includes("youtube") && (
              <p className="text-xs text-muted-foreground">
                YouTube: until Google raises SocialFlow&apos;s quota, only a few videos a day can be uploaded across all
                users. If an upload fails for this reason, try again tomorrow.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              <Button size="lg" className="h-11 px-6" onClick={handlePublish} disabled={saving}>
                {publishing ? <LoaderCircle className="animate-spin" /> : <Send />}
                {publishing ? "Publishing…" : "Publish now"}
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 px-6"
                onClick={() => (showSchedule ? setShowSchedule(false) : openSchedule())}
                disabled={saving}
                aria-expanded={showSchedule}
              >
                <CalendarClock />
                Schedule
              </Button>
              {queue.hasTimes ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 px-6"
                  onClick={handleQueue}
                  disabled={saving || !queue.next}
                  title={queue.next ? `Schedules it for ${queue.next}` : "Your queue is full. Add more posting times."}
                >
                  <ListPlus />
                  Add to queue
                </Button>
              ) : (
                <Link
                  href="/queue"
                  className={buttonVariants({ size: "lg", variant: "outline", className: "h-11 px-6" })}
                  title="Pick the times you like to post, then add posts to the queue"
                >
                  <ListPlus />
                  Set up queue
                </Link>
              )}
              <Button size="lg" variant="ghost" className="h-11 px-5" onClick={handleSave} disabled={saving}>
                {saving && !publishing && !showSchedule && <LoaderCircle className="animate-spin" />}
                Save draft
              </Button>
              {message && (
                <span className={cn("text-sm", message.ok ? "text-muted-foreground" : "text-destructive")}>
                  {message.text}
                </span>
              )}
            </div>
            {queue.hasTimes && (
              <p className="text-xs text-muted-foreground">
                {queue.next ? (
                  <>
                    Next free queue time: <span className="font-medium text-foreground">{queue.next}</span>.{" "}
                  </>
                ) : (
                  <>Your queue is full for the next 8 weeks. </>
                )}
                <Link href="/queue" className="font-medium text-primary hover:underline">
                  Edit queue
                </Link>
              </p>
            )}

            {showSchedule && <TimezoneWarning timezone={timezone} />}
            {showSchedule && (
              <div className="flex flex-wrap items-end gap-3 rounded-2xl bg-muted p-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-at">Publish on</Label>
                  <Input
                    id="schedule-at"
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => {
                      setMessage(null);
                      setScheduleAt(e.target.value);
                    }}
                    className="h-11 w-auto bg-card"
                  />
                </div>
                <Button size="lg" className="h-11 px-6" onClick={handleSchedule} disabled={saving || !scheduleAt}>
                  {saving && <LoaderCircle className="animate-spin" />}
                  Schedule post
                </Button>
                {bestTimes.times.length > 0 && (
                  <div className="w-full space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {bestTimes.personal ? "Your best times, from your past posts:" : "Good times to post (general advice until you have more posts):"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {bestTimes.times.map((t) => (
                        <button
                          key={t.local}
                          type="button"
                          onClick={() => {
                            setMessage(null);
                            setScheduleAt(t.local);
                          }}
                          aria-pressed={scheduleAt === t.local}
                          className={cn(
                            "rounded-full border px-3 py-1 text-sm transition-colors",
                            scheduleAt === t.local
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="w-full text-xs text-muted-foreground">
                  Time zone: {timeZoneLabel(timezone)}.{" "}
                  <Link href="/settings" className="font-medium text-primary hover:underline">
                    Change
                  </Link>
                </p>
              </div>
            )}
            {publishing && (
              <p className="text-xs text-muted-foreground">
                Videos can take a few minutes, because Instagram and YouTube process them first. Keep this tab open.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <div className="lg:sticky lg:top-8 lg:self-start">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Preview</p>
          {platforms.length > 1 && (
            <div className="flex gap-1">
              {platforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreviewChoice(p)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs",
                    previewPlatform === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {platformInfo(p).name}
                </button>
              ))}
            </div>
          )}
        </div>
        {previewPlatform && previewAccount ? (
          <PostPreview
            platform={previewPlatform}
            account={{
              name: previewAccount.display_name ?? previewAccount.username ?? "",
              username: previewAccount.username,
              avatarUrl: previewAccount.avatar_url,
            }}
            caption={captionFor(previewPlatform)}
            media={media}
            youtube={youtube}
            instagram={instagram}
          />
        ) : (
          <div className="rounded-2xl border-2 border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
            Choose an account to see a preview
          </div>
        )}
      </div>
    </div>
  );
}
