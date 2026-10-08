// Plain calendar-date helpers. Dates are "YYYY-MM-DD" strings with no time zone,
// so "the 15th" is the 15th wherever you are. Weeks start on Monday.

export type CalendarView = "month" | "week";

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isValidDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && fromUtc(toUtc(date)) === date;
}

export function addDays(date: string, days: number) {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

export function addMonths(date: string, months: number) {
  const [y, m] = date.split("-").map(Number);
  return fromUtc(Date.UTC(y, m - 1 + months, 1));
}

// Monday of the week containing `date`.
export function startOfWeek(date: string) {
  const weekday = (new Date(toUtc(date)).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(date, -weekday);
}

export function startOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

// The days shown for a view: whole weeks covering the month, or one week.
export function visibleDays(view: CalendarView, anchor: string): string[] {
  if (view === "week") {
    const monday = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  }
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const nextMonth = addMonths(first, 1);
  const days: string[] = [];
  for (let d = gridStart; d < nextMonth || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  return days;
}

// Where the ← and → buttons go.
export function shiftAnchor(view: CalendarView, anchor: string, direction: -1 | 1) {
  return view === "week" ? addDays(anchor, 7 * direction) : addMonths(anchor, direction);
}

export function viewTitle(view: CalendarView, anchor: string) {
  const fmt = (date: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en", { ...opts, timeZone: "UTC" }).format(new Date(toUtc(date)));
  if (view === "month") return fmt(anchor, { month: "long", year: "numeric" });
  const days = visibleDays("week", anchor);
  const [first, last] = [days[0], days[6]];
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  const start = fmt(first, { month: "short", day: "numeric" });
  const end = fmt(last, sameMonth ? { day: "numeric" } : { month: "short", day: "numeric" });
  return `${start} – ${end}, ${last.slice(0, 4)}`;
}

export function dayLabel(date: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en", { ...opts, timeZone: "UTC" }).format(new Date(toUtc(date)));
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
