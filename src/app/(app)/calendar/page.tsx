import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, SquarePen } from "lucide-react";
import { TimezoneWarning } from "@/components/timezone-warning";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  addDays,
  isValidDate,
  shiftAnchor,
  viewTitle,
  visibleDays,
  type CalendarView,
} from "@/lib/calendar";
import { getCalendarPosts, getCurrentUser, type CalendarPost } from "@/lib/data";
import { timeZoneLabel, utcToZonedInput, zonedTimeToUtc } from "@/lib/timezone";
import { CalendarGrid } from "./calendar-grid";

export const metadata: Metadata = { title: "Calendar" };

// Today's date in the user's time zone, as "YYYY-MM-DD".
function todayIn(timeZone: string) {
  return utcToZonedInput(new Date(), timeZone).slice(0, 10);
}

// /calendar?view=month|week&date=YYYY-MM-DD
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const today = todayIn(user.timezone);

  const view: CalendarView = params.view === "week" ? "week" : "month";
  const anchor = typeof params.date === "string" && isValidDate(params.date) ? params.date : today;
  const days = visibleDays(view, anchor);

  // The exact moments the first visible day starts and the last one ends, in the user's time zone.
  const from = zonedTimeToUtc(`${days[0]}T00:00`, user.timezone)!.toISOString();
  const to = zonedTimeToUtc(`${addDays(days[days.length - 1], 1)}T00:00`, user.timezone)!.toISOString();
  const posts = await getCalendarPosts(from, to, user.timezone);

  const postsByDay: Record<string, CalendarPost[]> = {};
  for (const post of posts) (postsByDay[post.localDate] ??= []).push(post);

  const link = (v: CalendarView, date: string) => `/calendar?view=${v}&date=${date}`;
  const navButton = "flex size-9 items-center justify-center rounded-full hover:bg-muted";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="min-w-48 text-2xl font-semibold tracking-tight">{viewTitle(view, anchor)}</h1>
          <Link href={link(view, shiftAnchor(view, anchor, -1))} className={navButton} aria-label="Previous">
            <ChevronLeft className="size-5" />
          </Link>
          <Link href={link(view, today)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Today
          </Link>
          <Link href={link(view, shiftAnchor(view, anchor, 1))} className={navButton} aria-label="Next">
            <ChevronRight className="size-5" />
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-full bg-muted p-1 text-sm">
            {(["month", "week"] as const).map((v) => (
              <Link
                key={v}
                href={link(v, anchor)}
                aria-current={view === v ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-1 capitalize",
                  view === v ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v}
              </Link>
            ))}
          </div>
          <Link href="/create" className={buttonVariants({ size: "lg" })}>
            <SquarePen />
            Create post
          </Link>
        </div>
      </div>

      <div className="mb-4 empty:hidden">
        <TimezoneWarning timezone={user.timezone} />
      </div>

      <CalendarGrid
        // Remount when the visible dates change, so expanded days and errors reset.
        key={`${view}-${days[0]}`}
        view={view}
        days={days}
        month={anchor.slice(0, 7)}
        today={today}
        postsByDay={postsByDay}
      />

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <Legend className="bg-accent" label="Scheduled" />
        <Legend className="bg-card ring-1 ring-border" label="Published" />
        <Legend className="bg-destructive/20" label="Failed" />
        <span>
          Times are in {timeZoneLabel(user.timezone)}. Drag a scheduled post to another day to move it.
        </span>
      </div>
    </>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded", className)} />
      {label}
    </span>
  );
}
