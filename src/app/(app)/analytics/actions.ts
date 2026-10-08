"use server";

import { revalidatePath } from "next/cache";
import { refreshUserMetrics } from "@/lib/analytics/collect";
import { createClient } from "@/lib/supabase/server";

const COOLDOWN_MS = 10 * 60 * 1000;

// "Refresh now": collect the latest numbers for this user straight away.
export async function refreshAnalytics(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("metrics_refreshed_at")
    .eq("id", user.id)
    .maybeSingle();
  const last = profile?.metrics_refreshed_at ? Date.parse(profile.metrics_refreshed_at) : 0;
  const wait = last + COOLDOWN_MS - Date.now();
  if (wait > 0) {
    return { error: `Numbers were refreshed recently. Try again in ${Math.ceil(wait / 60000)} min.` };
  }

  const summary = await refreshUserMetrics(user.id);
  revalidatePath("/analytics");
  if (summary.errors > 0 && summary.accounts === 0 && summary.posts === 0) {
    return { error: "Couldn't reach your accounts. Check Connections, then try again." };
  }
  return {};
}
