// Functions that read from the database on the server.
// Row Level Security makes sure each query only sees the logged-in user's rows.

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, SocialAccount } from "@/lib/types";

// The logged-in user and their profile. `cache` means the layout and the
// page can both call this during one request but Supabase is only asked once.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, timezone")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  const email = user.email ?? "";
  const name =
    profile?.full_name ||
    (user.user_metadata.full_name as string | undefined) ||
    email.split("@")[0];

  return {
    id: user.id,
    email,
    name,
    timezone: profile?.timezone ?? "UTC",
  };
});

export async function getSocialAccounts(): Promise<SocialAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_accounts")
    .select("id, platform, platform_account_id, display_name, username, avatar_url, status")
    .order("created_at");
  if (error) throw new Error(`Couldn't load social accounts: ${error.message}`);
  return data as SocialAccount[];
}

export async function getDashboardStats() {
  const supabase = await createClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // `head: true` asks only for the count, not the rows themselves.
  const [scheduled, published, accounts, posts] = await Promise.all([
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
    supabase
      .from("post_targets")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .gte("published_at", weekAgo),
    supabase
      .from("social_accounts")
      .select("id", { count: "exact", head: true })
      .eq("status", "connected"),
    supabase.from("posts").select("id", { count: "exact", head: true }),
  ]);

  const failed = [scheduled, published, accounts, posts].find((r) => r.error);
  if (failed?.error) throw new Error(`Couldn't load dashboard: ${failed.error.message}`);

  return {
    scheduledPosts: scheduled.count ?? 0,
    publishedThisWeek: published.count ?? 0,
    connectedAccounts: accounts.count ?? 0,
    totalPosts: posts.count ?? 0,
  };
}
