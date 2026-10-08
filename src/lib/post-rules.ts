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

export type YouTubeOptions = { title: string; privacy: "public" | "unlisted" | "private" };

export const CAPTION_LIMITS: Record<PlatformId, number> = {
  instagram: 2200,
  facebook: 63206,
  youtube: 5000, // the video description
};

export const YOUTUBE_TITLE_LIMIT = 100;
export const INSTAGRAM_MAX_HASHTAGS = 30;
export const INSTAGRAM_MAX_MEDIA = 10;

export function countHashtags(text: string) {
  return text.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;
}

// Returns a list of problems; an empty list means it's ready for that platform.
export function checkPost(
  platform: PlatformId,
  caption: string,
  media: MediaItem[],
  youtube: YouTubeOptions
): string[] {
  const problems: string[] = [];
  const videos = media.filter((m) => m.kind === "video");
  const limit = CAPTION_LIMITS[platform];

  if (caption.length > limit) {
    problems.push(`Caption is ${caption.length - limit} characters too long.`);
  }

  if (platform === "instagram") {
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

  if (platform === "facebook") {
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
  }

  return problems;
}
