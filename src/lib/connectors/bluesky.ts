import "server-only";
import { AtpAgent, XRPCError } from "@atproto/api";
import { PublishError } from "@/lib/publishing/types";

// Bluesky accounts connect with an app password (Bluesky > Settings > Privacy and
// security > App passwords), which can post but can't change the account's real password.
// Docs: https://docs.bsky.app/docs/get-started

// Accounts hosted by Bluesky itself. (Self-hosted servers would need their own address.)
const SERVICE = "https://bsky.social";

// Logs in and returns a ready-to-use client. `identifier` is a handle
// (e.g. name.bsky.social) or the account's DID.
export async function blueskyLogin(identifier: string, appPassword: string): Promise<AtpAgent> {
  const agent = new AtpAgent({ service: SERVICE });
  try {
    await agent.login({ identifier, password: appPassword });
    return agent;
  } catch (err) {
    if (err instanceof XRPCError && (err.status === 401 || err.error === "AuthenticationRequired")) {
      throw new PublishError("Bluesky didn't accept that handle and app password. Reconnect it.", {
        reconnect: true,
      });
    }
    if (err instanceof XRPCError && err.status === 429) {
      throw new PublishError("Bluesky is limiting logins right now. Try again in a few minutes.");
    }
    throw new PublishError("Couldn't reach Bluesky. Try again.");
  }
}

// Handles can be typed as "@name", "name" or "name.bsky.social".
export function normalizeHandle(input: string) {
  const handle = input.trim().replace(/^@/, "").toLowerCase();
  return handle.includes(".") ? handle : `${handle}.bsky.social`;
}
