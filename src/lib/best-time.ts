// "Best time to post": the weekday and hour when the user's own posts got the most
// engagement, or general good times while there isn't enough data yet.

import { utcToZonedInput } from "@/lib/timezone";

export type BestTime = { weekday: number; time: string }; // weekday 1 = Monday ... 7 = Sunday; time "HH:00"

export type BestTimes = {
  times: BestTime[];
  personal: boolean; // true = from the user's own posts; false = general advice
  basedOn: number; // how many published posts were used
};

// Below this many posts with numbers, one lucky post would decide everything.
export const MIN_POSTS_FOR_PERSONAL = 5;

// Widely reported good times across Instagram, Facebook and YouTube: mid-week,
// late morning and early evening. Used until the user has enough posts of their own.
export const GENERAL_BEST_TIMES: BestTime[] = [
  { weekday: 2, time: "11:00" }, // Tuesday 11 AM
  { weekday: 3, time: "18:00" }, // Wednesday 6 PM
  { weekday: 4, time: "12:00" }, // Thursday 12 PM
];

// Comments and shares take more effort than a like, so they count for more.
export function engagementScore(m: { likes: number; comments: number; shares: number }) {
  return m.likes + 2 * m.comments + 3 * m.shares;
}

// Ranks weekday + hour slots by the average engagement of posts published in them.
export function rankBestTimes(
  posts: { publishedAt: string; score: number }[],
  timeZone: string,
  count = 3
): BestTimes {
  if (posts.length < MIN_POSTS_FOR_PERSONAL) {
    return { times: GENERAL_BEST_TIMES.slice(0, count), personal: false, basedOn: posts.length };
  }

  const buckets = new Map<string, { weekday: number; time: string; total: number; posts: number }>();
  for (const p of posts) {
    const local = utcToZonedInput(new Date(p.publishedAt), timeZone); // "2026-10-15T19:42"
    const weekday = new Date(`${local.slice(0, 10)}T00:00:00Z`).getUTCDay() || 7;
    const time = `${local.slice(11, 13)}:00`;
    const key = `${weekday}-${time}`;
    const bucket = buckets.get(key) ?? { weekday, time, total: 0, posts: 0 };
    bucket.total += p.score;
    bucket.posts += 1;
    buckets.set(key, bucket);
  }

  const ranked = [...buckets.values()]
    .filter((b) => b.total > 0)
    // Highest average first; with a tie, the slot with more posts behind it.
    .sort((a, b) => b.total / b.posts - a.total / a.posts || b.posts - a.posts)
    .map(({ weekday, time }) => ({ weekday, time }));

  // Not enough slots with engagement yet: fill up with general times.
  for (const general of GENERAL_BEST_TIMES) {
    if (ranked.length >= count) break;
    if (!ranked.some((t) => t.weekday === general.weekday && t.time === general.time)) ranked.push(general);
  }
  return { times: ranked.slice(0, count), personal: true, basedOn: posts.length };
}
