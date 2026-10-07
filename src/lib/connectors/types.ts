import type { PlatformId, ProviderId } from "@/lib/platforms";

// One account found after the user logs in with a provider.
// A Meta login can return several (each Facebook Page, plus any linked Instagram account).
export type ConnectedAccount = {
  platform: PlatformId;
  platformAccountId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
};

// What every login provider (Google for YouTube, Meta for Facebook/Instagram) must offer.
export type Connector = {
  id: ProviderId;
  name: string;
  // The env vars this provider needs; if any are missing, Connect shows a friendly error.
  requiredEnv: string[];
  // The provider's login page that we send the user to.
  authorizeUrl: (opts: { redirectUri: string; state: string }) => string;
  // After the user approves: swap the one-time code for tokens and look up their accounts.
  handleCallback: (opts: { code: string; redirectUri: string }) => Promise<ConnectedAccount[]>;
};
