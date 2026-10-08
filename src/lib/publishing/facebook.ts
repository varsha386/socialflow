import "server-only";
import { graph } from "./graph";
import type { PublishJob, PublishResult } from "./types";

// Publishes to a Facebook Page.
// Docs: https://developers.facebook.com/docs/pages-api/posts
export async function publishToFacebook(job: PublishJob): Promise<PublishResult> {
  const { platformAccountId: pageId, accessToken: token, caption, media } = job;
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
