// What each platform accepts, and checks that tell the user what to fix
// before publishing. Used by the Create post screen (and later by publishing).

import type { PlatformId } from "@/lib/platforms";

export type MediaItem = {
  id: string;
  url: string;
  storagePath: string;
  mimeType: string;
  kind: "image" | "video";
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
};

// A YouTube upload is a normal video or a Short. YouTube makes any vertical or square video
// of up to 3 minutes a Short; there's no separate upload for them.
export type YouTubeOptions = { title: string; privacy: "public" | "unlisted" | "private"; format?: "video" | "short" };
export const YOUTUBE_SHORT_MAX_SECONDS = 180;

// Facebook Pages can post to the feed or a Story (one photo, or a video of up to 60 seconds, no caption).
export type FacebookOptions = { format: "feed" | "story" };
export const DEFAULT_FACEBOOK: FacebookOptions = { format: "feed" };
export const FACEBOOK_STORY_MAX_SECONDS = 60;

// Instagram can post to the feed (a photo, carousel or Reel) or as a Story (one photo
// or video, shown for 24 hours, no caption).
export type InstagramOptions = { format: "feed" | "story" };
export const DEFAULT_INSTAGRAM: InstagramOptions = { format: "feed" };

// Pinterest: every Pin goes on a board (each account has its own boards), with an optional
// title and a link people can click through to. The caption becomes the Pin's description.
export type PinterestOptions = { title: string; link: string; boards: Record<string, string> }; // account ID -> board ID
export const DEFAULT_PINTEREST: PinterestOptions = { title: "", link: "", boards: {} };
export type PinterestPin = { boardId: string; title: string; link: string }; // what one account's Pin uses
export const PINTEREST_TITLE_LIMIT = 100;
export const PINTEREST_MAX_IMAGES = 5; // a carousel has 2–5
export const INSTAGRAM_STORY_MAX_SECONDS = 60;

export const CAPTION_LIMITS: Record<PlatformId, number> = {
  instagram: 2200,
  facebook: 63206,
  youtube: 5000, // the video description
  bluesky: 300, // counted in "graphemes": an emoji or accented letter counts once
  threads: 500,
  linkedin: 3000,
  pinterest: 800, // the Pin's description
};

export const LINKEDIN_MAX_IMAGES = 20; // a multi-image post

export const THREADS_MAX_MEDIA = 20; // carousel items
export const THREADS_POSTS_PER_DAY = 250; // per account, in a rolling 24 hours (Meta's limit)

export const BLUESKY_MAX_IMAGES = 4;

// Characters as people see them (Bluesky counts this way; "👍🏽" is one, not four).
export function countGraphemes(text: string) {
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].length;
}

export const YOUTUBE_TITLE_LIMIT = 100;
export const INSTAGRAM_MAX_HASHTAGS = 30;
export const INSTAGRAM_MAX_MEDIA = 20; // carousel items (Meta's content publishing docs)
export const INSTAGRAM_POSTS_PER_DAY = 100; // per account, in a rolling 24 hours (Meta's limit)

export function countHashtags(text: string) {
  return text.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;
}

// Returns a list of problems; an empty list means it's ready for that platform.
export function checkPost(
  platform: PlatformId,
  caption: string,
  media: MediaItem[],
  youtube: YouTubeOptions,
  instagram: InstagramOptions = DEFAULT_INSTAGRAM,
  pinterest: PinterestOptions = DEFAULT_PINTEREST,
  facebook: FacebookOptions = DEFAULT_FACEBOOK
): string[] {
  const problems: string[] = [];
  const videos = media.filter((m) => m.kind === "video");
  const limit = CAPTION_LIMITS[platform];
  const story =
    (platform === "instagram" && instagram.format === "story") || (platform === "facebook" && facebook.format === "story");

  // Stories don't show a caption, so its length doesn't matter there.
  const length = platform === "bluesky" ? countGraphemes(caption) : caption.length;
  if (length > limit && !story) {
    problems.push(`Caption is ${length - limit} characters too long.`);
  }

  if (platform === "threads") {
    if (!caption.trim() && media.length === 0) problems.push("Write something or add a photo or video.");
    if (media.length > THREADS_MAX_MEDIA) problems.push(`Use ${THREADS_MAX_MEDIA} files or fewer.`);
    if (media.some((m) => m.mimeType === "image/gif")) problems.push("GIFs aren't supported.");
  }

  if (platform === "linkedin") {
    if (!caption.trim() && media.length === 0) problems.push("Write something or add a photo or video.");
    if (videos.length > 0 && media.length > 1) problems.push("A video post can only have that one video.");
    if (videos.some((v) => v.mimeType !== "video/mp4")) problems.push("LinkedIn videos must be MP4 (not MOV).");
    if (videos.some((v) => v.durationSeconds !== null && v.durationSeconds < 3)) {
      problems.push("LinkedIn videos must be at least 3 seconds long.");
    }
    if (media.length > LINKEDIN_MAX_IMAGES) problems.push(`Use ${LINKEDIN_MAX_IMAGES} photos or fewer.`);
  }

  // Choosing a board is checked per account, where the boards are known (Create and publishing).
  if (platform === "pinterest") {
    if (media.length === 0) problems.push("Add a photo: every Pin needs one.");
    if (videos.length > 0) problems.push("Pinterest videos aren't supported in Ripple yet. Use photos.");
    if (media.length > PINTEREST_MAX_IMAGES) problems.push(`Use ${PINTEREST_MAX_IMAGES} photos or fewer.`);
    if (pinterest.title.length > PINTEREST_TITLE_LIMIT) {
      problems.push(`Title is ${pinterest.title.length - PINTEREST_TITLE_LIMIT} characters too long.`);
    }
    if (pinterest.link.trim() && !/^https?:\/\/\S+$/i.test(pinterest.link.trim())) {
      problems.push("The link must start with http:// or https://.");
    }
  }

  if (platform === "bluesky") {
    if (!caption.trim() && media.length === 0) problems.push("Write something or add a photo.");
    if (videos.length > 0) problems.push("Bluesky videos aren't supported in Ripple yet. Use photos.");
    if (media.length > BLUESKY_MAX_IMAGES) problems.push(`Use ${BLUESKY_MAX_IMAGES} photos or fewer.`);
    if (media.some((m) => m.mimeType === "image/gif")) problems.push("GIFs aren't supported.");
  }

  if (story) {
    if (media.length !== 1) problems.push("A Story needs exactly one photo or video.");
    if (media.some((m) => m.mimeType === "image/gif")) problems.push("GIFs aren't supported.");
    const video = media.find((m) => m.kind === "video");
    const maxSeconds = platform === "facebook" ? FACEBOOK_STORY_MAX_SECONDS : INSTAGRAM_STORY_MAX_SECONDS;
    if (video?.durationSeconds && video.durationSeconds > maxSeconds) {
      problems.push(`Story videos can be up to ${maxSeconds} seconds long.`);
    }
  } else if (platform === "instagram") {
    if (media.length === 0) problems.push("Add at least one photo or video.");
    if (media.length > INSTAGRAM_MAX_MEDIA) problems.push(`Use ${INSTAGRAM_MAX_MEDIA} files or fewer.`);
    if (countHashtags(caption) > INSTAGRAM_MAX_HASHTAGS) {
      problems.push(`Use ${INSTAGRAM_MAX_HASHTAGS} hashtags or fewer.`);
    }
    if (media.some((m) => m.mimeType === "image/gif")) problems.push("GIFs aren't supported.");
    const badRatio = media.some((m) => {
      if (m.kind !== "image" || !m.width || !m.height) return false;
      const ratio = m.width / m.height;
      return ratio < 0.8 || ratio > 1.91;
    });
    if (badRatio) problems.push("Photos must be between 4:5 (portrait) and 1.91:1 (landscape).");
  }

  if (platform === "facebook" && !story) {
    if (!caption.trim() && media.length === 0) problems.push("Write something or add a photo or video.");
    if (videos.length > 0 && media.length > 1) problems.push("A video post can only have that one video.");
  }

  if (platform === "youtube") {
    if (videos.length !== 1 || media.length !== 1) problems.push("Add exactly one video (no photos).");
    if (!youtube.title.trim()) problems.push("Add a video title.");
    if (youtube.title.length > YOUTUBE_TITLE_LIMIT) {
      problems.push(`Title is ${youtube.title.length - YOUTUBE_TITLE_LIMIT} characters too long.`);
    }
    if (/[<>]/.test(youtube.title + caption)) problems.push("YouTube doesn't allow < or > characters.");
    const video = videos[0];
    if (youtube.format === "short" && video) {
      if (video.width && video.height && video.width > video.height) {
        problems.push("A Short must be vertical or square. This video is wider than it is tall.");
      }
      if (video.durationSeconds && video.durationSeconds > YOUTUBE_SHORT_MAX_SECONDS) {
        problems.push(`A Short can be up to ${YOUTUBE_SHORT_MAX_SECONDS / 60} minutes long.`);
      }
    }
  }

  return problems;
}
