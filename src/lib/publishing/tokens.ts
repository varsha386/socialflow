import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshPinterestToken } from "@/lib/connectors/pinterest";
import { refreshThreadsToken } from "@/lib/connectors/threads";
import { decrypt, encrypt } from "@/lib/crypto";
import type { PlatformId } from "@/lib/platforms";
import { PublishError } from "./types";

// Returns a working access token for an account, decrypting it from the
// database. YouTube tokens only last an hour, so they're renewed here when needed.
export async function getAccessToken(
  admin: SupabaseClient,
  accountId: string,
  platform: PlatformId
): Promise<string> {
  const { data: row, error } = await admin
    .from("social_account_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error || !row) throw new PublishError("This account's login is missing. Reconnect it.", { reconnect: true });

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : null;

  // Threads logins last 60 days: renew them when under 10 days are left, so people
  // who post regularly never have to reconnect. If renewing fails, the old one is used while it lasts.
  const tenDays = 10 * 24 * 60 * 60 * 1000;
  if (platform === "threads" && expiresAt !== null && expiresAt > Date.now() && expiresAt < Date.now() + tenDays) {
    try {
      const renewed = await refreshThreadsToken(decrypt(row.access_token));
      await admin
        .from("social_account_tokens")
        .update({ access_token: encrypt(renewed.accessToken), expires_at: renewed.expiresAt.toISOString() })
        .eq("account_id", accountId);
      return renewed.accessToken;
    } catch (err) {
      console.error("[threads] couldn't renew the login:", err);
    }
  }

  // Pinterest logins last 30 days and come with a refresh token (good for 60 days, and
  // replaced on every refresh): renew when under 5 days are left, or once expired.
  const fiveDays = 5 * 24 * 60 * 60 * 1000;
  if (platform === "pinterest" && row.refresh_token && expiresAt !== null && expiresAt < Date.now() + fiveDays) {
    try {
      const renewed = await refreshPinterestToken(decrypt(row.refresh_token));
      await admin
        .from("social_account_tokens")
        .update({
          access_token: encrypt(renewed.accessToken),
          ...(renewed.refreshToken ? { refresh_token: encrypt(renewed.refreshToken) } : {}),
          expires_at: renewed.expiresAt.toISOString(),
        })
        .eq("account_id", accountId);
      return renewed.accessToken;
    } catch (err) {
      console.error("[pinterest] couldn't renew the login:", err);
      if (expiresAt <= Date.now()) throw new PublishError("Pinterest needs you to reconnect this account.", { reconnect: true });
    }
  }

  const stillValid = expiresAt === null || expiresAt > Date.now() + 2 * 60 * 1000;
  if (stillValid) return decrypt(row.access_token);

  if (platform !== "youtube" || !row.refresh_token) {
    throw new PublishError("This account's login has expired. Reconnect it.", { reconnect: true });
  }

  // Ask Google for a fresh access token using the long-lasting refresh token.
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: decrypt(row.refresh_token),
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) {
    // invalid_grant = the user removed access, or (in testing mode) the 7-day refresh token expired.
    throw new PublishError("YouTube needs you to reconnect your channel.", { reconnect: true });
  }

  await admin
    .from("social_account_tokens")
    .update({
      access_token: encrypt(body.access_token),
      expires_at: new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString(),
    })
    .eq("account_id", accountId);

  return body.access_token;
}
