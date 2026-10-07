import "server-only";
import { encrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProviderId } from "@/lib/platforms";
import { metaConnector } from "./meta";
import type { ConnectedAccount, Connector } from "./types";
import { youtubeConnector } from "./youtube";

export const CONNECTORS: Record<ProviderId, Connector> = {
  youtube: youtubeConnector,
  meta: metaConnector,
};

export function getConnector(id: string): Connector | null {
  return id in CONNECTORS ? CONNECTORS[id as ProviderId] : null;
}

export function missingEnv(connector: Connector): string[] {
  return [...connector.requiredEnv, "SUPABASE_SECRET_KEY", "TOKEN_ENCRYPTION_KEY"].filter(
    (name) => !process.env[name]
  );
}

// Saves (or updates) the accounts for this user, with their tokens encrypted.
export async function saveAccounts(userId: string, accounts: ConnectedAccount[]) {
  const admin = createAdminClient();

  for (const account of accounts) {
    const { data: row, error } = await admin
      .from("social_accounts")
      .upsert(
        {
          user_id: userId,
          platform: account.platform,
          platform_account_id: account.platformAccountId,
          display_name: account.displayName,
          username: account.username,
          avatar_url: account.avatarUrl,
          status: "connected",
        },
        { onConflict: "user_id,platform,platform_account_id" }
      )
      .select("id")
      .single();
    if (error) throw new Error(`Couldn't save account: ${error.message}`);

    const tokenRow: Record<string, string | null> = {
      account_id: row.id,
      access_token: encrypt(account.accessToken),
      expires_at: account.expiresAt?.toISOString() ?? null,
    };
    // Google only sends a refresh token sometimes; don't erase a saved one.
    if (account.refreshToken) tokenRow.refresh_token = encrypt(account.refreshToken);

    const { error: tokenError } = await admin
      .from("social_account_tokens")
      .upsert(tokenRow, { onConflict: "account_id" });
    if (tokenError) throw new Error(`Couldn't save token: ${tokenError.message}`);
  }
}
