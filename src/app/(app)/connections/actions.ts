"use server";

import { revalidatePath } from "next/cache";
import { saveAccounts } from "@/lib/connectors";
import { blueskyLogin, blueskyProfile, normalizeHandle } from "@/lib/connectors/bluesky";
import { newAccountsAllowed } from "@/lib/plan-limits";
import { FREE_LIMITS } from "@/lib/plans";
import { PublishError } from "@/lib/publishing/types";
import { createClient } from "@/lib/supabase/server";

// Removes a connected account. Its saved tokens are deleted with it (ON DELETE CASCADE).
// Row Level Security means people can only delete their own accounts.
export async function disconnectAccount(accountId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("social_accounts").delete().eq("id", accountId);
  if (error) throw new Error("Couldn't disconnect that account. Try again.");
  revalidatePath("/connections");
  revalidatePath("/dashboard");
}

// Connects (or reconnects) a Bluesky account with its handle and an app password.
// The app password is checked by logging in, then stored encrypted like other logins.
export async function connectBluesky(handleInput: string, appPasswordInput: string): Promise<{ error?: string }> {
  const handle = normalizeHandle(handleInput);
  const appPassword = appPasswordInput.trim();
  if (!/^[a-z0-9.-]{3,253}$/.test(handle)) return { error: "Enter your Bluesky handle, like name.bsky.social." };
  // Bluesky app passwords always look like xxxx-xxxx-xxxx-xxxx. Anything else is probably the
  // main account password, which must never be stored: it can change or delete the account.
  if (!/^[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(appPassword)) {
    return {
      error: "Paste an app password (it looks like xxxx-xxxx-xxxx-xxxx), not your main Bluesky password. Create one in Bluesky under Settings > Privacy and security > App passwords.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  let agent;
  try {
    agent = await blueskyLogin(handle, appPassword);
  } catch (err) {
    if (err instanceof PublishError && err.reconnect) {
      return {
        error:
          "Bluesky didn't accept that handle and app password. Check both, and use an app password, not your main Bluesky password.",
      };
    }
    return { error: err instanceof PublishError ? err.message : "Couldn't reach Bluesky. Try again." };
  }

  const did = agent.did;
  if (!did) return { error: "Couldn't reach Bluesky. Try again." };
  // Bluesky's logged-in profile lookup sometimes fails with "Internal Server Error", so
  // the name and photo come from its public service, falling back to the handle.
  const profile = await blueskyProfile(did);

  // Free plan: reconnecting an account they already have is always allowed.
  const { data: existing } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("platform", "bluesky")
    .eq("platform_account_id", did)
    .maybeSingle();
  if (!existing && (await newAccountsAllowed(user.id)) < 1) {
    return {
      error: `The Free plan includes ${FREE_LIMITS.accounts} connected accounts, and you've reached it. Upgrade to Pro on the Plan page to connect more.`,
    };
  }

  await saveAccounts(user.id, [
    {
      platform: "bluesky",
      platformAccountId: did, // stays the same even if they change their handle
      displayName: profile?.displayName || profile?.handle || handle,
      username: profile?.handle ?? handle,
      avatarUrl: profile?.avatar ?? null,
      accessToken: appPassword,
      refreshToken: null,
      expiresAt: null,
    },
  ]);
  revalidatePath("/connections");
  revalidatePath("/create");
  return {};
}
