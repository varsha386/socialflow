import "server-only";
import { FREE_LIMITS, toPlan, type Plan, type Usage } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { utcToZonedInput, zonedTimeToUtc } from "@/lib/timezone";

// Checks the Free plan's limits on the server. Uses the secret key so the same checks
// work from pages, actions and the connect callback; always filters by the user's ID.
// If a count can't be read, the action is allowed: a database hiccup shouldn't block people.

// Posts in these states count towards the monthly scheduling allowance.
const COUNTED_STATUSES = ["scheduled", "publishing", "published", "partially_published", "failed"];

const limitMessage = (what: string) =>
  `The Free plan includes ${what}. Upgrade to Pro on the Plan page for unlimited.`;

// The calendar month that `at` falls in, in the user's time zone, as exact start/end moments.
function monthRange(at: Date, timeZone: string) {
  const [year, month] = utcToZonedInput(at, timeZone).slice(0, 7).split("-").map(Number);
  const next = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  return {
    start: zonedTimeToUtc(`${year}-${String(month).padStart(2, "0")}-01T00:00`, timeZone)!.toISOString(),
    end: zonedTimeToUtc(`${next}-01T00:00`, timeZone)!.toISOString(),
  };
}

export async function getPlanInfo(userId: string): Promise<{ plan: Plan; timeZone: string }> {
  const { data } = await createAdminClient().from("profiles").select("plan, timezone").eq("id", userId).maybeSingle();
  return { plan: toPlan(data?.plan), timeZone: (data?.timezone as string | undefined) ?? "UTC" };
}

async function countScheduled(userId: string, at: Date, timeZone: string, excludePostId?: string) {
  const { start, end } = monthRange(at, timeZone);
  let query = createAdminClient()
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", COUNTED_STATUSES)
    .gte("scheduled_at", start)
    .lt("scheduled_at", end);
  if (excludePostId) query = query.neq("id", excludePostId);
  const { count, error } = await query;
  if (error) console.error("[plan] couldn't count scheduled posts:", error.message);
  return error ? 0 : (count ?? 0);
}

async function countAiCaptions(userId: string, timeZone: string) {
  const { start, end } = monthRange(new Date(), timeZone);
  const { count, error } = await createAdminClient()
    .from("ai_caption_uses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start)
    .lt("created_at", end);
  if (error) console.error("[plan] couldn't count AI caption uses:", error.message);
  return error ? 0 : (count ?? 0);
}

async function countAccounts(userId: string) {
  const { count } = await createAdminClient()
    .from("social_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

// Everything the Plan page shows.
export async function getUsage(userId: string, timeZone: string): Promise<Usage> {
  const [accounts, scheduledThisMonth, aiCaptionsThisMonth] = await Promise.all([
    countAccounts(userId),
    countScheduled(userId, new Date(), timeZone),
    countAiCaptions(userId, timeZone),
  ]);
  return { accounts, scheduledThisMonth, aiCaptionsThisMonth };
}

// Before scheduling `postId` at `when`: an error message, or null if it's allowed.
// Counts the month the post goes out in, not counting this post (so rescheduling is fine).
export async function scheduleLimitError(userId: string, postId: string, when: Date): Promise<string | null> {
  const { plan, timeZone } = await getPlanInfo(userId);
  if (plan === "pro") return null;
  const used = await countScheduled(userId, when, timeZone, postId);
  return used >= FREE_LIMITS.scheduledPerMonth
    ? limitMessage(`${FREE_LIMITS.scheduledPerMonth} scheduled posts per month, and that month is full`)
    : null;
}

// Before using the AI Caption Writer: an error message, or null if it's allowed.
export async function aiCaptionLimitError(userId: string): Promise<string | null> {
  const { plan, timeZone } = await getPlanInfo(userId);
  if (plan === "pro") return null;
  const used = await countAiCaptions(userId, timeZone);
  return used >= FREE_LIMITS.aiCaptionsPerMonth
    ? limitMessage(`${FREE_LIMITS.aiCaptionsPerMonth} AI caption requests per month, and you've used them all`)
    : null;
}

export async function recordAiCaptionUse(userId: string) {
  const { error } = await createAdminClient().from("ai_caption_uses").insert({ user_id: userId });
  if (error) console.error("[plan] couldn't record an AI caption use:", error.message);
}

// How many NEW accounts this user may still connect (Infinity on Pro).
// Reconnecting an account they already have never counts.
export async function newAccountsAllowed(userId: string): Promise<number> {
  const { plan } = await getPlanInfo(userId);
  if (plan === "pro") return Infinity;
  return Math.max(0, FREE_LIMITS.accounts - (await countAccounts(userId)));
}
