import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, ListClock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PlatformBadge } from "@/components/platform-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBestTimes, getCurrentUser, getQueueOverview, getQueueSlots } from "@/lib/data";
import { PLATFORMS } from "@/lib/platforms";
import { WEEKDAYS } from "@/lib/queue";
import { timeZoneLabel } from "@/lib/timezone";
import { AddTimesForm, RemoveTimeButton, SuggestedTimes } from "./queue-times";

export const metadata: Metadata = { title: "Queue" };

export default async function QueuePage() {
  const user = await getCurrentUser();
  const [slots, best] = await Promise.all([getQueueSlots(), getBestTimes(user.timezone)]);
  const items = await getQueueOverview(user.timezone, slots);
  const suggested = best.times.map((t) => ({
    ...t,
    inQueue: slots.some((s) => s.weekday === t.weekday && s.time === t.time),
  }));

  const formatDay = (iso: string) =>
    new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "short", timeZone: user.timezone }).format(
      new Date(iso)
    );
  const formatTime = (iso: string) =>
    new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: user.timezone }).format(new Date(iso));

  // Group the next two weeks by day for the list on the right.
  const days: { label: string; items: typeof items }[] = [];
  for (const item of items) {
    const label = formatDay(item.at);
    if (days.at(-1)?.label === label) days.at(-1)!.items.push(item);
    else days.push({ label, items: [item] });
  }

  return (
    <>
      <PageHeader
        title="Queue"
        description="Pick the times you like to post. “Add to queue” on Create puts each post in the next free time."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Posting times</CardTitle>
            <CardDescription>
              Every week, in your time zone ({timeZoneLabel(user.timezone)}).{" "}
              <Link href="/settings" className="font-medium text-primary hover:underline">
                Change
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {slots.length > 0 && (
              <ul className="space-y-2">
                {WEEKDAYS.map((day) => {
                  const times = slots.filter((s) => s.weekday === day.value);
                  if (times.length === 0) return null;
                  return (
                    <li key={day.value} className="flex flex-wrap items-center gap-2">
                      <span className="w-12 shrink-0 text-sm font-medium">{day.short}</span>
                      {times.map((slot) => (
                        <RemoveTimeButton key={slot.id} slot={slot} dayName={day.long} />
                      ))}
                    </li>
                  );
                })}
              </ul>
            )}
            <AddTimesForm hasTimes={slots.length > 0} />
            <SuggestedTimes personal={best.personal} times={suggested} />
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Next 2 weeks</CardTitle>
            <CardDescription>Your queue times and scheduled posts.</CardDescription>
          </CardHeader>
          <CardContent>
            {days.length === 0 ? (
              <div className="flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center">
                <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <ListClock className="size-5" />
                </span>
                <p className="font-medium">Nothing coming up</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  Add a posting time, then use “Add to queue” when you create a post.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {days.map((day) => (
                  <section key={day.label}>
                    <h3 className="mb-2 text-sm font-medium text-muted-foreground">{day.label}</h3>
                    <ul className="space-y-2">
                      {day.items.map((item) => (
                        <li key={item.at + (item.post?.id ?? "")}>
                          {item.post ? (
                            <Link
                              href={`/posts/${item.post.id}`}
                              className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2.5 hover:bg-accent"
                            >
                              <span className="w-16 shrink-0 text-sm font-medium">{formatTime(item.at)}</span>
                              <span className="min-w-0 flex-1 truncate text-sm">
                                {item.post.caption || <span className="text-muted-foreground">No caption</span>}
                              </span>
                              {!item.isSlot && (
                                <CalendarClock
                                  className="size-4 shrink-0 text-muted-foreground"
                                  aria-label="Scheduled outside your queue times"
                                />
                              )}
                              <span className="flex shrink-0">
                                {item.post.platforms.map((id) => (
                                  <span key={id} className="-ml-2 scale-75 rounded-2xl ring-2 ring-muted">
                                    <PlatformBadge platform={PLATFORMS.find((p) => p.id === id)!} />
                                  </span>
                                ))}
                              </span>
                            </Link>
                          ) : (
                            <div className="flex items-center gap-3 rounded-2xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
                              <span className="w-16 shrink-0 font-medium">{formatTime(item.at)}</span>
                              <span>Free</span>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
