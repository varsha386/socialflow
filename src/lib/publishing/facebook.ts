import "server-only";
import type { MediaItem } from "@/lib/post-rules";
import { graph } from "./graph";
import { PublishError, type PublishJob, type PublishResult } from "./types";

// Publishes to a Facebook Page.
// Docs: https://developers.facebook.com/docs/pages-api/posts
export async function publishToFacebook(job: PublishJob): Promise<PublishResult> {
  const { platformAccountId: pageId, accessToken: token, caption, media } = job;
  if (job.facebook.format === "story") return publishStory(pageId, token, media[0]);
  const video = media.find((m) => m.kind === "video");

  // A video post (Facebook downloads the file from our storage).
  if (video) {
    const { id } = await graph<{ id: string }>(
      "POST",
      `/${pageId}/videos`,
      { file_url: video.url, description: caption },
      token
    );
    return { externalId: id, url: await permalink(id, token) };
  }

  // A single photo with a caption.
  if (media.length === 1) {
    const { id, post_id } = await graph<{ id: string; post_id?: string }>(
      "POST",
      `/${pageId}/photos`,
      { url: media[0].url, caption },
      token
    );
    const postId = post_id ?? id;
    return { externalId: postId, url: await permalink(postId, token) };
  }

  // Several photos: upload each one unpublished, then publish them together in one post.
  const attached: Record<string, string> = {};
  for (const [i, item] of media.entries()) {
    const { id } = await graph<{ id: string }>(
      "POST",
      `/${pageId}/photos`,
      { url: item.url, published: "false" },
      token
    );
    attached[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
  }

  // Text only (or text with the photos attached above).
  const { id } = await graph<{ id: string }>(
    "POST",
    `/${pageId}/feed`,
    { message: caption, ...attached },
    token
  );
  return { externalId: id, url: await permalink(id, token) };
}

// A Story: one photo, or a video of up to 60 seconds, shown for 24 hours. Stories have no caption.
// Docs: https://developers.facebook.com/docs/page-stories-api
async function publishStory(pageId: string, token: string, item: MediaItem | undefined): Promise<PublishResult> {
  if (!item) throw new PublishError("A Story needs one photo or video.");

  if (item.kind === "image") {
    // Upload the photo without posting it, then make it a Story.
    const { id: photoId } = await graph<{ id: string }>("POST", `/${pageId}/photos`, { url: item.url, published: "false" }, token);
    const { post_id } = await graph<{ post_id: string }>("POST", `/${pageId}/photo_stories`, { photo_id: photoId }, token);
    return { externalId: post_id, url: null };
  }

  // A video: start an upload, let Facebook fetch the file from our storage, then publish it.
  const start = await graph<{ video_id: string; upload_url: string }>(
    "POST",
    `/${pageId}/video_stories`,
    { upload_phase: "start" },
    token
  );
  const upload = await fetch(start.upload_url, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_url: item.url },
  });
  if (!upload.ok) throw new PublishError("Facebook couldn't fetch the video for the Story. Try again.");
  const { post_id } = await graph<{ post_id: string }>(
    "POST",
    `/${pageId}/video_stories`,
    { upload_phase: "finish", video_id: start.video_id },
    token
  );
  return { externalId: post_id, url: null };
}

// Facebook's link to the post. Not essential, so failures are ignored.
async function permalink(id: string, token: string): Promise<string | null> {
  try {
    const { permalink_url } = await graph<{ permalink_url?: string }>(
      "GET",
      `/${id}`,
      { fields: "permalink_url" },
      token
    );
    if (!permalink_url) return null;
    return permalink_url.startsWith("http") ? permalink_url : `https://www.facebook.com${permalink_url}`;
  } catch {
    return null;
  }
}
