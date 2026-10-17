// The posting queue: weekly times a user likes to post (e.g. Monday 09:00) in their
// own time zone. "Add to queue" schedules a post at the next time that's still free.

import { utcToZonedInput, zonedTimeToUtc } from "@/lib/timezone";

export type QueueSlot = { id: string; weekday: number; time: string }; // weekday 1 = Monday ... 7 = Sunday; time "HH:MM"

export const WEEKDAYS = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
  { value: 7, short: "Sun", long: "Sunday" },
];

// How far ahead "Add to queue" looks for a free time.
export const QUEUE_HORIZON_DAYS = 56;

const DAY_MS = 24 * 60 * 60 * 1000;

// "09:00" -> "9:00 AM"
export function formatSlotTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// Every queue time after `from`, for `days` calendar days in the user's time zone, earliest first.
export function upcomingSlotTimes(slots: QueueSlot[], timeZone: string, from: Date, days: number): Date[] {
  const today = utcToZonedInput(from, timeZone).slice(0, 10);
  const start = Date.parse(`${today}T00:00:00Z`);
  const times: Date[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(start + i * DAY_MS);
    const date = day.toISOString().slice(0, 10);
    const weekday = day.getUTCDay() || 7; // getUTCDay: 0 = Sunday
    for (const slot of slots) {
      if (slot.weekday !== weekday) continue;
      const at = zonedTimeToUtc(`${date}T${slot.time}`, timeZone);
      if (at && at > from) times.push(at);
    }
  }
  return times.sort((a, b) => a.getTime() - b.getTime());
}

// Scheduled times are compared to the minute.
export const minuteOf = (date: Date | string) => Math.floor(new Date(date).getTime() / 60_000);
