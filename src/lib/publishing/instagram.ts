import "server-only";
import type { MediaItem } from "@/lib/post-rules";
import { graph, sleep } from "./graph";
import { PublishError, type PublishJob, type PublishResult } from "./types";

// Publishes to an Instagram Business/Creator account (through its Facebook Page token).
// Instagram works in two steps: create a "container" from a public file URL,
// wait until Instagram has processed it, then publish the container.
// Docs: https://developers.facebook.com/docs/instagram-platform/content-publishing
export async function publishToInstagram(job: PublishJob): Promise<PublishResult> {
  const { platformAccountId: igUserId, accessToken: token, caption, media } = job;
  let containerId: string;

  if (media.length === 1) {
    containerId = await createContainer(igUserId, token, media[0], { caption });
  } else {
    // Carousel: one container per item, then a parent container holding them.
    const children: string[] = [];
    for (const item of media) {
      children.push(await createContainer(igUserId, token, item, { is_carousel_item: "true" }));
    }
    await Promise.all(children.map((id) => waitUntilReady(id, token)));
    const { id } = await graph<{ id: string }>(
      "POST",
      `/${igUserId}/media`,
      { media_type: "CAROUSEL", children: children.join(","), caption },
      token
    );
    containerId = id;
  }

  await waitUntilReady(containerId, token);

  const { id: mediaId } = await graph<{ id: string }>(
    "POST",
    `/${igUserId}/media_publish`,
    { creation_id: containerId },
    token
  );

  let url: string | null = null;
  try {
    const { permalink } = await graph<{ permalink?: string }>("GET", `/${mediaId}`, { fields: "permalink" }, token);
    url = permalink ?? null;
  } catch {
    // The link is nice to have; the post is already live.
  }
  return { externalId: mediaId, url };
}

async function createContainer(
  igUserId: string,
  token: string,
  item: MediaItem,
  extra: Record<string, string>
): Promise<string> {
  const params: Record<string, string> =
    item.kind === "video"
      ? // A single video becomes a Reel; inside a carousel it's a plain video.
        { media_type: extra.is_carousel_item ? "VIDEO" : "REELS", video_url: item.url, ...extra }
      : { image_url: item.url, ...extra };
  const { id } = await graph<{ id: string }>("POST", `/${igUserId}/media`, params, token);
  return id;
}

// Videos can take a minute or more to process. Checks every 5 seconds, for up to ~4 minutes.
async function waitUntilReady(containerId: string, token: string) {
  for (let attempt = 0; attempt < 48; attempt++) {
    const { status_code, status } = await graph<{ status_code?: string; status?: string }>(
      "GET",
      `/${containerId}`,
      { fields: "status_code,status" },
      token
    );
    if (status_code === "FINISHED" || status_code === "PUBLISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new PublishError(
        `Instagram couldn't process this file${status ? ` (${status})` : ""}. Videos must be MP4 or MOV (H.264), 3–90 seconds works best.`
      );
    }
    await sleep(5000);
  }
  throw new PublishError("Instagram is taking too long to process the video. Try again in a few minutes.");
}
