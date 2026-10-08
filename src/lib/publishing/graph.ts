import "server-only";
import { GRAPH_VERSION } from "@/lib/connectors/meta";
import { PublishError } from "./types";

const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

type GraphErrorBody = {
  error?: { message: string; code?: number; error_subcode?: number; error_user_msg?: string };
};

// Calls the Facebook Graph API (used for both Facebook Pages and Instagram).
export async function graph<T>(
  method: "GET" | "POST",
  path: string,
  params: Record<string, string>,
  accessToken: string
): Promise<T> {
  const query = new URLSearchParams({ ...params, access_token: accessToken });
  const res =
    method === "GET"
      ? await fetch(`${GRAPH}${path}?${query}`)
      : await fetch(`${GRAPH}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: query,
        });
  const body = (await res.json()) as T & GraphErrorBody;

  if (!res.ok || body.error) {
    const err = body.error;
    // 190 = the token expired or was revoked (e.g. password changed, app removed).
    if (err?.code === 190) {
      throw new PublishError("Facebook needs you to reconnect this account.", { reconnect: true });
    }
    // 10 / 200-299 = a permission is missing.
    if (err?.code === 10 || (err?.code && err.code >= 200 && err.code < 300)) {
      throw new PublishError(
        "SocialFlow doesn't have permission to post here. Reconnect and allow all the permissions Facebook asks for.",
        { reconnect: true }
      );
    }
    throw new PublishError(err?.error_user_msg || err?.message || `Facebook returned error ${res.status}.`);
  }
  return body;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
