import "server-only";
import { PublishError } from "@/lib/publishing/types";
import type { Connector } from "./types";

// Connects a Pinterest account with "Log in with Pinterest".
// Docs: https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/
// Until Pinterest gives the app "Standard access", it must use the sandbox (PINTEREST_SANDBOX=1):
// Pins made there are only visible to the account that made them, and video Pins can't be made.
// Logins last 30 days and come with a refresh token, so they're renewed automatically (see tokens.ts).

const API =
  process.env.PINTEREST_SANDBOX === "1" ? "https://api-sandbox.pinterest.com/v5" : "https://api.pinterest.com/v5";

const SCOPES = [
  "user_accounts:read", // name and photo
  "boards:read", // list boards to choose from
  "boards:write", // Pinterest requires these four to create (and delete) Pins
  "pins:read",
  "pins:write",
];

type PinterestError = { code?: number; message?: string };

// Calls the Pinterest API.
export async function pinterestApi<T>(method: "GET" | "POST" | "DELETE", path: string, accessToken: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as T & PinterestError;
  if (!res.ok) {
    if (res.status === 401) throw new PublishError("Pinterest needs you to reconnect this account.", { reconnect: true });
    if (res.status === 403) {
      throw new PublishError("Ripple doesn't have permission to do this. Reconnect Pinterest and allow everything it asks for.", {
        reconnect: true,
      });
    }
    if (res.status === 404) throw new PublishError("Pinterest couldn't find it. It may have been deleted.");
    if (res.status === 429) throw new PublishError("Pinterest's limit for Ripple has been reached. Try again later.");
    throw new PublishError(data.message ? `Pinterest: ${data.message}` : `Pinterest returned error ${res.status}.`);
  }
  return data;
}

// Gets new tokens, with the app's ID and secret sent as a "Basic" login.
async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.PINTEREST_APP_ID}:${process.env.PINTEREST_APP_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const body = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; message?: string };
  if (!res.ok || !body.access_token) throw new Error(`Pinterest token request failed: ${body.message ?? res.status}`);
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (body.expires_in ?? 30 * 24 * 60 * 60) * 1000),
  };
}

// Renews a login. Each refresh also returns a new refresh token, valid for another 60 days.
export function refreshPinterestToken(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export type PinterestBoard = { id: string; name: string };

// The account's boards, for choosing where a Pin goes. Pinterest can return empty pages
// with a bookmark to the next one, so this keeps going (up to 10 pages of 250).
export async function listPinterestBoards(accessToken: string): Promise<PinterestBoard[]> {
  const boards: PinterestBoard[] = [];
  let bookmark: string | null = null;
  for (let page = 0; page < 10; page++) {
    const query: string = new URLSearchParams({ page_size: "250", ...(bookmark ? { bookmark } : {}) }).toString();
    const res: { items?: PinterestBoard[]; bookmark?: string | null } = await pinterestApi("GET", `/boards?${query}`, accessToken);
    boards.push(...(res.items ?? []).map((b) => ({ id: b.id, name: b.name })));
    bookmark = res.bookmark ?? null;
    if (!bookmark) break;
  }
  return boards.sort((a, b) => a.name.localeCompare(b.name));
}

export const pinterestConnector: Connector = {
  id: "pinterest",
  name: "Pinterest",
  requiredEnv: ["PINTEREST_APP_ID", "PINTEREST_APP_SECRET"],

  authorizeUrl({ redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: process.env.PINTEREST_APP_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(","),
      state,
    });
    return `https://www.pinterest.com/oauth/?${params}`;
  },

  async handleCallback({ code, redirectUri }) {
    // 1. One-time code -> access token (30 days) and refresh token (60 days, renewed on each refresh).
    const tokens = await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });

    // 2. Who they are.
    const me = await pinterestApi<{ id?: string; username?: string; business_name?: string | null; profile_image?: string }>(
      "GET",
      "/user_account",
      tokens.accessToken
    );
    const id = me.id ?? me.username;
    if (!id) throw new Error("Pinterest profile lookup returned no ID");

    return [
      {
        platform: "pinterest",
        platformAccountId: id,
        displayName: me.business_name || me.username || "Pinterest",
        username: me.username ?? null,
        avatarUrl: me.profile_image ?? null,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      },
    ];
  },
};
