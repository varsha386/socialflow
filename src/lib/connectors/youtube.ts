import "server-only";
import type { ConnectedAccount, Connector } from "./types";

// Connects a YouTube channel using Google OAuth.
// Docs: https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload", // upload videos
  "https://www.googleapis.com/auth/youtube.readonly", // read channel info and stats
];

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
};

type ChannelsResponse = {
  items?: {
    id: string;
    snippet: {
      title: string;
      customUrl?: string;
      thumbnails?: { default?: { url: string } };
    };
  }[];
  error?: { message: string };
};

export const youtubeConnector: Connector = {
  id: "youtube",
  name: "YouTube",
  requiredEnv: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],

  authorizeUrl({ redirectUri, state }) {
    const params = new URLSearchParams({
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline", // gives us a refresh token to stay connected
      // select_account: always show the account picker (so you can choose a Brand Account channel).
      // consent: always ask for permission, so Google always sends the refresh token.
      prompt: "select_account consent",
      include_granted_scopes: "true",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },

  async handleCallback({ code, redirectUri }) {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.YOUTUBE_CLIENT_ID!,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokens = (await tokenRes.json()) as TokenResponse;
    if (!tokenRes.ok) {
      throw new Error(`Google token error: ${tokens.error_description ?? tokens.error}`);
    }

    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const channels = (await channelRes.json()) as ChannelsResponse;
    if (!channelRes.ok) {
      throw new Error(`YouTube API error: ${channels.error?.message ?? channelRes.status}`);
    }
    if (!channels.items?.length) {
      throw new Error("NO_CHANNEL");
    }

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    return channels.items.map(
      (channel): ConnectedAccount => ({
        platform: "youtube",
        platformAccountId: channel.id,
        displayName: channel.snippet.title,
        username: channel.snippet.customUrl?.replace(/^@/, "") ?? null,
        avatarUrl: channel.snippet.thumbnails?.default?.url ?? null,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        expiresAt,
      })
    );
  },
};
