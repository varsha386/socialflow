"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert, LoaderCircle, Plus } from "lucide-react";
import { schedulePost } from "@/app/(app)/create/actions";
import { cn } from "@/lib/utils";
import { WEEKDAYS, dayLabel, type CalendarView } from "@/lib/calendar";
import type { CalendarPost } from "@/lib/data";
import { PLATFORMS } from "@/lib/platforms";

const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-accent text-accent-foreground hover:ring-primary/40",
  publishing: "bg-accent text-accent-foreground",
  published: "bg-card text-muted-foreground ring-border hover:ring-foreground/30",
  partially_published: "bg-destructive/10 text-destructive hover:ring-destructive/30",
  failed: "bg-destructive/10 text-destructive hover:ring-destructive/30",
};

const MONTH_LIMIT = 3; // posts shown per day in month view before "+N more"

export function CalendarGrid({
  view,
  days,
  month,
  today,
  postsByDay,
}: {
  view: CalendarView;
  days: string[];
  month: string; // "YYYY-MM" of the month being shown (other days are dimmed)
  today: string;
  postsByDay: Record<string, CalendarPost[]>;
}) {
  const router = useRouter();
  const [dragging, setDragging] = useState<CalendarPost | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moving, startMoving] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Drop a scheduled post on another day: same time, new date.
  function handleDrop(day: string) {
    const post = dragging;
    setDragging(null);
    setDropDay(null);
    if (!post || post.localDate === day) return;
    if (day < today) {
      setError("You can't move a post into the past.");
      return;
    }
    setError(null);
    startMoving(async () => {
      const result = await schedulePost(post.id, `${day}T${post.localTime}`);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <div>
      {(error || moving) && (
        <div
          role="status"
          className={cn(
            "mb-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm",
            error ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
          )}
        >
          {moving ? <LoaderCircle className="size-4 animate-spin" /> : <CircleAlert className="size-4" />}
          {moving ? "Rescheduling…" : error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const posts = postsByDay[day] ?? [];
            const inMonth = view === "week" || day.startsWith(month);
            const isToday = day === today;
            const isPast = day < today;
            const showAll = view === "week" || expanded === day;
            const shown = showAll ? posts : posts.slice(0, MONTH_LIMIT);

            return (
              <div
                key={day}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  setDropDay(day);
                }}
                onDragLeave={() => setDropDay((d) => (d === day ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(day);
                }}
                className={cn(
                  "group relative flex flex-col gap-1 border-border p-1.5 sm:p-2",
                  i % 7 !== 6 && "border-r",
                  i < days.length - 7 && "border-b",
                  view === "month" ? "min-h-24 sm:min-h-32" : "min-h-80",
                  !inMonth && "bg-muted/40",
                  dropDay === day && (isPast ? "bg-destructive/10" : "bg-accent")
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-xs sm:text-sm",
                      isToday && "bg-primary font-semibold text-primary-foreground",
                      !isToday && !inMonth && "text-muted-foreground/60",
                      !isToday && inMonth && isPast && "text-muted-foreground"
                    )}
                  >
                    {view === "week" ? dayLabel(day, { day: "numeric" }) : Number(day.slice(8))}
                  </span>
                  {!isPast && (
                    <Link
                      href={`/create?date=${day}`}
                      className="hidden size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground sm:flex sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Create a post for ${dayLabel(day, { month: "long", day: "numeric" })}`}
                      title="Create a post for this day"
                    >
                      <Plus className="size-4" />
                    </Link>
                  )}
                </div>

                {shown.map((post) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    draggable={post.status === "scheduled"}
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(post);
                      setError(null);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setDropDay(null);
                    }}
                    title={post.caption || "No caption"}
                    className={cn(
                      "flex gap-1 rounded-lg px-1 py-0.5 text-[10px] ring-1 ring-transparent transition-shadow sm:px-1.5 sm:py-1 sm:text-xs",
                      view === "month" ? "items-center" : "flex-col",
                      STATUS_STYLE[post.status],
                      post.status === "scheduled" && "cursor-grab active:cursor-grabbing",
                      dragging?.id === post.id && "opacity-40"
                    )}
                  >
                    <span className="flex shrink-0 items-center gap-1">
                      <span className="font-medium tabular-nums">{post.localTime}</span>
                      <span className={cn("-space-x-0.5", view === "month" ? "hidden sm:flex" : "flex")}>
                        {post.platforms.map((id) => (
                          <span
                            key={id}
                            className="size-2 rounded-full ring-1 ring-card"
                            style={{ backgroundColor: PLATFORMS.find((p) => p.id === id)?.color }}
                          />
                        ))}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "min-w-0",
                        view === "month" ? "hidden truncate md:inline" : "line-clamp-2 w-full"
                      )}
                    >
                      {post.caption || "No caption"}
                    </span>
                  </Link>
                ))}

                {!showAll && posts.length > MONTH_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setExpanded(day)}
                    className="rounded-lg px-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
                  >
                    +{posts.length - MONTH_LIMIT}<span className="hidden sm:inline"> more</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
