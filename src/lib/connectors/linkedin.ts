import "server-only";
import { PublishError } from "@/lib/publishing/types";
import type { Connector } from "./types";

// Connects a personal LinkedIn profile, with the "Share on LinkedIn" and "Sign In with
// LinkedIn using OpenID Connect" products (both self-serve, no review needed).
// Docs: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
// Company Pages need LinkedIn's separate, vetted Community Management API, so they're not supported.
// Logins last 60 days and can't be renewed without LinkedIn partner approval, so people reconnect.

const REST = "https://api.linkedin.com/rest";
// LinkedIn's monthly API version (YYYYMM). Each one is supported for about a year.
export const LINKEDIN_VERSION = "202609";

const SCOPES = [
  "openid", // sign in
  "profile", // name and photo
  "w_member_social", // post, and delete posts, on the member's behalf
];

// Calls LinkedIn's versioned REST API.
export function linkedinFetch(method: "POST" | "DELETE", path: string, accessToken: string, body?: unknown) {
  return fetch(`${REST}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Linkedin-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      ...(method === "DELETE" ? { "X-RestLi-Method": "DELETE" } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Turns a failed LinkedIn response into a message that's useful to show.
export async function linkedinError(res: Response): Promise<PublishError> {
  let message = "";
  try {
    message = ((await res.json()) as { message?: string }).message ?? "";
  } catch {
    // Not JSON; fall through to the generic message.
  }
  if (res.status === 401) return new PublishError("LinkedIn needs you to reconnect this account.", { reconnect: true });
  if (res.status === 403) {
    return new PublishError("SocialFlow doesn't have permission to post here. Reconnect LinkedIn and allow everything it asks for.", {
      reconnect: true,
    });
  }
  if (res.status === 429) return new PublishError("LinkedIn's daily limit for this account has been reached. Try again tomorrow.");
  return new PublishError(message ? `LinkedIn: ${message}` : `LinkedIn returned error ${res.status}.`);
}

export const linkedinConnector: Connector = {
  id: "linkedin",
  name: "LinkedIn",
  requiredEnv: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],

  authorizeUrl({ redirectUri, state }) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      redirect_uri: redirectUri,
      scope: SCOPES.join(" "),
      state,
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
  },

  async handleCallback({ code, redirectUri }) {
    // 1. One-time code -> access token (60 days).
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });
    const token = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!res.ok || !token.access_token) {
      throw new Error(`LinkedIn login failed: ${token.error_description ?? res.status}`);
    }

    // 2. Who they are. `sub` is their member ID, used as urn:li:person:{sub} when posting.
    const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const me = (await meRes.json()) as { sub?: string; name?: string; picture?: string };
    if (!meRes.ok || !me.sub) throw new Error(`LinkedIn profile lookup failed: ${meRes.status}`);

    return [
      {
        platform: "linkedin",
        platformAccountId: me.sub,
        displayName: me.name || "LinkedIn",
        username: null, // LinkedIn doesn't share the profile's public address with this product
        avatarUrl: me.picture ?? null,
        accessToken: token.access_token,
        refreshToken: null,
        expiresAt: new Date(Date.now() + (token.expires_in ?? 60 * 24 * 60 * 60) * 1000),
      },
    ];
  },
};
