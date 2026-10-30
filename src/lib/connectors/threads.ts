import "server-only";
import { PublishError } from "@/lib/publishing/types";
import type { Connector } from "./types";

// Connects a Threads profile with "Log in with Threads".
// Docs: https://developers.facebook.com/docs/threads/get-started/get-access-tokens-and-permissions
// Uses the Threads app ID and secret, which are different from the Facebook ones.

export const THREADS_GRAPH = "https://graph.threads.com";
const API = `${THREADS_GRAPH}/v1.0`;

const SCOPES = [
  "threads_basic", // read the profile (required for everything)
  "threads_content_publish", // publish posts
  "threads_delete", // delete posts made through Ripple (Posts > Delete)
];

type ThreadsError = { error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string } };

// Calls the Threads API. A token problem (code 190) means the person must reconnect.
export async function threadsApi<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Record<string, string>,
  accessToken: string,
  base = API
): Promise<T> {
  const query = new URLSearchParams({ ...params, access_token: accessToken });
  const res =
    method === "POST"
      ? await fetch(`${base}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: query,
        })
      : await fetch(`${base}${path}?${query}`, { method });
  const body = (await res.json()) as T & ThreadsError;
  if (!res.ok || body.error) {
    const err = body.error;
    if (err?.code === 190) throw new PublishError("Threads needs you to reconnect this account.", { reconnect: true });
    if (err?.code === 10 || (err?.code && err.code >= 200 && err.code < 300)) {
      throw new PublishError("Ripple doesn't have permission to post here. Reconnect Threads and allow everything it asks for.", {
        reconnect: true,
      });
    }
    // 803, or 100 with subcode 33, = that post doesn't exist (or was already deleted).
    const gone = err?.code === 803 || (err?.code === 100 && err.error_subcode === 33) || res.status === 404;
    throw new PublishError(err?.error_user_msg || err?.message || `Threads returned error ${res.status}.`, { notFound: gone });
  }
  return body;
}

// Long-lived tokens last 60 days and can be renewed once they're at least a day old.
export async function refreshThreadsToken(accessToken: string) {
  const res = await threadsApi<{ access_token: string; expires_in: number }>(
    "GET",
    "/refresh_access_token",
    { grant_type: "th_refresh_token" },
    accessToken,
    THREADS_GRAPH
  );
  return { accessToken: res.access_token, expiresAt: new Date(Date.now() + res.expires_in * 1000) };
}

export const threadsConnector: Connector = {
  id: "threads",
  name: "Threads",
  requiredEnv: ["THREADS_APP_ID", "THREADS_APP_SECRET"],

  authorizeUrl({ redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: process.env.THREADS_APP_ID!,
      redirect_uri: redirectUri,
      scope: SCOPES.join(","),
      response_type: "code",
      state,
    });
    return `https://threads.com/oauth/authorize?${params}`;
  },

  async handleCallback({ code, redirectUri }) {
    // 1. One-time code -> short-lived token (1 hour).
    const res = await fetch(`${THREADS_GRAPH}/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.THREADS_APP_ID!,
        client_secret: process.env.THREADS_APP_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        // Threads sometimes adds "#_" to the code in the address.
        code: code.replace(/#_$/, ""),
      }),
    });
    const short = (await res.json()) as { access_token?: string } & ThreadsError;
    if (!res.ok || !short.access_token) {
      throw new Error(`Threads login failed: ${short.error?.message ?? res.status}`);
    }

    // 2. Short-lived -> long-lived token (60 days).
    const long = await threadsApi<{ access_token: string; expires_in: number }>(
      "GET",
      "/access_token",
      { grant_type: "th_exchange_token", client_secret: process.env.THREADS_APP_SECRET! },
      short.access_token,
      THREADS_GRAPH
    );

    // 3. Who they are.
    const me = await threadsApi<{ id: string; username?: string; name?: string; threads_profile_picture_url?: string }>(
      "GET",
      "/me",
      { fields: "id,username,name,threads_profile_picture_url" },
      long.access_token
    );

    return [
      {
        platform: "threads",
        platformAccountId: me.id,
        displayName: me.name || me.username || "Threads",
        username: me.username ?? null,
        avatarUrl: me.threads_profile_picture_url ?? null,
        accessToken: long.access_token,
        refreshToken: null,
        expiresAt: new Date(Date.now() + long.expires_in * 1000),
      },
    ];
  },
};
