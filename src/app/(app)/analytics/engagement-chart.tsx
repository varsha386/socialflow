"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dayLabel } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { refreshAnalytics } from "./actions";

type Day = { date: string; likes: number; comments: number; shares: number };

// "Nice" round numbers for the y-axis top (e.g. 37 -> 40, 120 -> 150).
function niceMax(value: number) {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * power >= value)!;
  return step * power;
}

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

// Bar chart: total engagement (likes + comments + shares) on posts published each day.
export function EngagementChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const totals = days.map((d) => d.likes + d.comments + d.shares);
  const max = niceMax(Math.max(...totals, 0));
  const ticks = [max, max / 2, 0];
  const active = hover === null ? null : days[hover];

  return (
    <div>
      <div className="relative flex h-56 gap-2">
        {/* y-axis labels */}
        <div className="flex w-8 flex-col justify-between pb-6 text-right text-xs text-muted-foreground tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-1/2">
              {t.toLocaleString()}
            </span>
          ))}
        </div>

        <div className="relative flex-1">
          {/* gridlines */}
          <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {ticks.map((t) => (
              <div key={t} className={cn("border-t", t === 0 ? "border-border" : "border-dashed border-border/60")} />
            ))}
          </div>

          {/* bars */}
          <div className="absolute inset-x-0 top-0 bottom-6 flex items-end gap-0.5" onMouseLeave={() => setHover(null)}>
            {days.map((d, i) => {
              const total = totals[i];
              return (
                <button
                  key={d.date}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${dayLabel(d.date, { month: "short", day: "numeric" })}: ${plural(total, "interaction")}`}
                  className="group flex h-full flex-1 items-end"
                >
                  <span
                    className={cn(
                      "w-full rounded-t bg-primary transition-opacity",
                      hover !== null && hover !== i && "opacity-40"
                    )}
                    style={{ height: total === 0 ? 0 : `max(2px, ${(total / max) * 100}%)` }}
                  />
                </button>
              );
            })}
          </div>

          {/* x-axis labels: every 7th day */}
          <div className="absolute inset-x-0 bottom-0 flex h-5 text-xs text-muted-foreground">
            {days.map((d, i) => (
              <span key={d.date} className="relative flex-1">
                {(days.length - 1 - i) % 7 === 0 && (
                  <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
                    {dayLabel(d.date, { month: "short", day: "numeric" })}
                  </span>
                )}
              </span>
            ))}
          </div>

          {/* tooltip */}
          {active && hover !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-xl border bg-popover p-3 text-xs shadow-md"
              style={{ left: `clamp(5.5rem, ${((hover + 0.5) / days.length) * 100}%, calc(100% - 5.5rem))` }}
            >
              <p className="mb-1.5 font-medium">{dayLabel(active.date, { weekday: "short", month: "short", day: "numeric" })}</p>
              <p className="flex justify-between"><span className="text-muted-foreground">Likes</span><span className="tabular-nums">{active.likes.toLocaleString()}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Comments</span><span className="tabular-nums">{active.comments.toLocaleString()}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Shares</span><span className="tabular-nums">{active.shares.toLocaleString()}</span></p>
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowTable((s) => !s)}
        className="mt-3 text-xs font-medium text-primary hover:underline"
        aria-expanded={showTable}
      >
        {showTable ? "Hide table" : "Show as table"}
      </button>
      {showTable && (
        <div className="mt-2 max-h-64 overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Day</th>
                <th className="px-3 py-2 text-right font-medium">Likes</th>
                <th className="px-3 py-2 text-right font-medium">Comments</th>
                <th className="px-3 py-2 text-right font-medium">Shares</th>
              </tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {[...days].reverse().map((d) => (
                <tr key={d.date}>
                  <td className="px-3 py-1.5">{dayLabel(d.date, { month: "short", day: "numeric" })}</td>
                  <td className="px-3 py-1.5 text-right">{d.likes.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right">{d.comments.toLocaleString()}</td>
                  <td className="px-3 py-1.5 text-right">{d.shares.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function RefreshButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {error && <span className="text-sm text-destructive">{error}</span>}
      <Button
        variant="outline"
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await refreshAnalytics();
            if (result.error) setError(result.error);
          })
        }
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
        {pending ? "Refreshing…" : "Refresh now"}
      </Button>
    </div>
  );
}
