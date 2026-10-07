import "server-only";
import type { ConnectedAccount, Connector } from "./types";

// Connects Facebook Pages and their linked Instagram Business/Creator accounts
// with one Facebook Login.
// Docs: https://developers.facebook.com/docs/pages-api and
//       https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login

export const GRAPH_VERSION = "v23.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

const SCOPES = [
  "pages_show_list", // see the Pages you manage
  "pages_read_engagement", // read Page info
  "pages_manage_posts", // publish to Pages
  "business_management", // include Pages owned through a Business portfolio
  "instagram_basic", // see linked Instagram accounts
  "instagram_content_publish", // publish to Instagram
];

type GraphError = { error?: { message: string } };

type PagesResponse = GraphError & {
  data?: {
    id: string;
    name: string;
    access_token: string;
    picture?: { data?: { url?: string } };
    instagram_business_account?: {
      id: string;
      username?: string;
      name?: string;
      profile_picture_url?: string;
    };
  }[];
};

async function graphGet<T extends GraphError>(path: string, params: Record<string, string>) {
  const res = await fetch(`${GRAPH}${path}?${new URLSearchParams(params)}`);
  const body = (await res.json()) as T;
  if (!res.ok || body.error) {
    throw new Error(`Facebook API error: ${body.error?.message ?? res.status}`);
  }
  return body;
}

export const metaConnector: Connector = {
  id: "meta",
  name: "Facebook",
  requiredEnv: ["META_APP_ID", "META_APP_SECRET"],

  authorizeUrl({ redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: SCOPES.join(","),
    });
    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params}`;
  },

  async handleCallback({ code, redirectUri }) {
    const appId = process.env.META_APP_ID!;
    const appSecret = process.env.META_APP_SECRET!;

    // 1. One-time code -> short-lived user token (about 1 hour).
    const short = await graphGet<GraphError & { access_token: string }>("/oauth/access_token", {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

    // 2. Short-lived -> long-lived user token (about 60 days).
    const long = await graphGet<GraphError & { access_token: string }>("/oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: short.access_token,
    });

    // 3. The Pages this person manages. Page tokens from a long-lived user
    //    token don't expire, and they're also used to publish to Instagram.
    const pages = await graphGet<PagesResponse>("/me/accounts", {
      access_token: long.access_token,
      fields:
        "id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}",
      limit: "100",
    });

    if (!pages.data?.length) throw new Error("NO_PAGES");

    const accounts: ConnectedAccount[] = [];
    for (const page of pages.data) {
      accounts.push({
        platform: "facebook",
        platformAccountId: page.id,
        displayName: page.name,
        username: null,
        avatarUrl: page.picture?.data?.url ?? null,
        accessToken: page.access_token,
        refreshToken: null,
        expiresAt: null,
      });

      const ig = page.instagram_business_account;
      if (ig) {
        accounts.push({
          platform: "instagram",
          platformAccountId: ig.id,
          displayName: ig.name || ig.username || page.name,
          username: ig.username ?? null,
          avatarUrl: ig.profile_picture_url ?? null,
          accessToken: page.access_token,
          refreshToken: null,
          expiresAt: null,
        });
      }
    }
    return accounts;
  },
};
