// Converts between a wall-clock time in a time zone ("2026-10-15T19:00" in
// Asia/Kolkata) and an exact moment (a Date). Uses the browser/Node built-in
// time zone data, so daylight-saving changes are handled.

// How far ahead of UTC the time zone is at that moment, in milliseconds.
function offsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asIfUtc - Math.floor(utcMs / 1000) * 1000;
}

// "2026-10-15T19:00" in `timeZone` -> the exact moment as a Date.
// Returns null if the text isn't a valid date and time.
export function zonedTimeToUtc(local: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const [y, mo, d, h, mi] = match.slice(1).map(Number);
  const wallClock = Date.UTC(y, mo - 1, d, h, mi);

  // Guess using the offset at that time, then correct once in case the guess
  // crossed a daylight-saving change.
  let utc = wallClock - offsetMs(wallClock, timeZone);
  const corrected = wallClock - offsetMs(utc, timeZone);
  if (corrected !== utc) utc = corrected;
  return new Date(utc);
}

// A Date -> "2026-10-15T19:00" as seen in `timeZone` (the format <input type="datetime-local"> uses).
export function utcToZonedInput(date: Date, timeZone: string): string {
  const shifted = new Date(date.getTime() + offsetMs(date.getTime(), timeZone));
  return shifted.toISOString().slice(0, 16);
}
