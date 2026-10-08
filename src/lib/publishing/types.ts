import type { MediaItem, YouTubeOptions } from "@/lib/post-rules";

// Everything a platform publisher needs to send one post to one account.
export type PublishJob = {
  platformAccountId: string; // the Page ID, Instagram user ID, or YouTube channel ID
  accessToken: string;
  caption: string;
  media: MediaItem[];
  youtube: YouTubeOptions;
};

export type PublishResult = {
  externalId: string; // the post's ID on the platform
  url: string | null; // a link to view it, when the platform gives one
};

// An error with a message that's safe and useful to show the user.
// `reconnect` means the account's login has expired or been revoked.
export class PublishError extends Error {
  reconnect: boolean;
  constructor(message: string, opts: { reconnect?: boolean } = {}) {
    super(message);
    this.name = "PublishError";
    this.reconnect = opts.reconnect ?? false;
  }
}
