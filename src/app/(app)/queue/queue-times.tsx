"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEEKDAYS, formatSlotTime, type QueueSlot } from "@/lib/queue";
import { cn } from "@/lib/utils";
import { addQueueTimes, deleteQueueTime } from "./actions";

const WEEKDAYS_ONLY = [1, 2, 3, 4, 5];
const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];

// Pick one or more days and a time, then add that time to each day.
export function AddTimesForm({ hasTimes }: { hasTimes: boolean }) {
  const [days, setDays] = useState<number[]>(WEEKDAYS_ONLY);
  const [time, setTime] = useState("09:00");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (day: number) => {
    setError(null);
    setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]));
  };
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));

  return (
    <div className={cn("space-y-3", hasTimes && "border-t pt-5")}>
      <p className="text-sm font-medium">{hasTimes ? "Add another time" : "Add your first posting time"}</p>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days">
          {WEEKDAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              aria-pressed={days.includes(day.value)}
              aria-label={day.long}
              onClick={() => toggle(day.value)}
              className={cn(
                "h-9 min-w-11 rounded-full border px-3 text-sm transition-colors",
                days.includes(day.value)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {day.short}
            </button>
          ))}
        </div>
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            className={cn("hover:underline", same(days, WEEKDAYS_ONLY) ? "text-foreground" : "text-primary")}
            onClick={() => setDays(WEEKDAYS_ONLY)}
          >
            Weekdays
          </button>
          <button
            type="button"
            className={cn("hover:underline", same(days, EVERY_DAY) ? "text-foreground" : "text-primary")}
            onClick={() => setDays(EVERY_DAY)}
          >
            Every day
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="queue-time">Time</Label>
          <Input
            id="queue-time"
            type="time"
            value={time}
            onChange={(e) => {
              setError(null);
              setTime(e.target.value);
            }}
            className="h-11 w-auto bg-card"
          />
        </div>
        <Button
          size="lg"
          className="h-11 px-5"
          disabled={pending || days.length === 0 || !time}
          onClick={() =>
            startTransition(async () => {
              const result = await addQueueTimes(days, time);
              setError(result.error ?? null);
            })
          }
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Plus />}
          Add time
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// Best times to post, each with a one-click "add to my queue".
export function SuggestedTimes({
  personal,
  times,
}: {
  personal: boolean;
  times: { weekday: number; time: string; inQueue: boolean }[];
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2 border-t pt-5">
      <p className="text-sm font-medium">Suggested times</p>
      <p className="text-xs text-muted-foreground">
        {personal ? "When your past posts got the most likes, comments and shares." : "General good times, until you have more posts of your own."}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {times.map((t) => {
          const key = `${t.weekday}-${t.time}`;
          const label = `${WEEKDAYS[t.weekday - 1].short} ${formatSlotTime(t.time)}`;
          return t.inQueue ? (
            <span key={key} className="rounded-full border border-dashed px-3 py-1 text-sm text-muted-foreground">
              {label} · in queue
            </span>
          ) : (
            <button
              key={key}
              type="button"
              disabled={pending}
              onClick={() => {
                setAdding(key);
                startTransition(async () => {
                  const result = await addQueueTimes([t.weekday], t.time);
                  setError(result.error ?? null);
                  setAdding(null);
                });
              }}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              aria-label={`Add ${WEEKDAYS[t.weekday - 1].long} ${formatSlotTime(t.time)} to your queue`}
            >
              {adding === key ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              {label}
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// One posting time, shown as a chip with a remove button.
export function RemoveTimeButton({ slot, dayName }: { slot: QueueSlot; dayName: string }) {
  const [pending, startTransition] = useTransition();
  const label = `${dayName} ${formatSlotTime(slot.time)}`;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-3 text-sm text-accent-foreground">
      {formatSlotTime(slot.time)}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await deleteQueueTime(slot.id);
          })
        }
        className="flex size-6 items-center justify-center rounded-full hover:bg-background/60"
        aria-label={`Remove ${label}`}
        title={`Remove ${label}`}
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
      </button>
    </span>
  );
}
