import "server-only";
import { threadsApi } from "@/lib/connectors/threads";
import type { MediaItem } from "@/lib/post-rules";
import { sleep } from "./graph";
import { PublishError, type PublishJob, type PublishResult } from "./types";

// Publishes to Threads: a text post, one photo or video, or a carousel (2–20 items).
// Like Instagram, it's two steps: create a "container" from public file addresses,
// wait until Threads has processed it, then publish it.
// Docs: https://developers.facebook.com/docs/threads/posts

export async function publishToThreads(job: PublishJob): Promise<PublishResult> {
  const { platformAccountId: userId, accessToken: token, caption, media } = job;
  const text: Record<string, string> = caption.trim() ? { text: caption } : {};
  let containerId: string;

  if (media.length === 0) {
    containerId = await create(userId, token, { media_type: "TEXT", text: caption });
  } else if (media.length === 1) {
    containerId = await create(userId, token, { ...mediaParams(media[0]), ...text });
  } else {
    const children: string[] = [];
    for (const item of media) {
      children.push(await create(userId, token, { ...mediaParams(item), is_carousel_item: "true" }));
    }
    await Promise.all(children.map((id) => waitUntilReady(id, token)));
    containerId = await create(userId, token, { media_type: "CAROUSEL", children: children.join(","), ...text });
  }

  await waitUntilReady(containerId, token);
  const { id: mediaId } = await threadsApi<{ id: string }>(
    "POST",
    `/${userId}/threads_publish`,
    { creation_id: containerId },
    token
  );

  let url: string | null = null;
  try {
    const { permalink } = await threadsApi<{ permalink?: string }>("GET", `/${mediaId}`, { fields: "permalink" }, token);
    url = permalink ?? null;
  } catch {
    // The link is nice to have; the post is already live.
  }
  return { externalId: mediaId, url };
}

function mediaParams(item: MediaItem): Record<string, string> {
  return item.kind === "video"
    ? { media_type: "VIDEO", video_url: item.url }
    : { media_type: "IMAGE", image_url: item.url };
}

async function create(userId: string, token: string, params: Record<string, string>) {
  const { id } = await threadsApi<{ id: string }>("POST", `/${userId}/threads`, params, token);
  return id;
}

// Threads processes photos and videos before they can be published. Checks every
// 3 seconds, for up to about 4 minutes.
async function waitUntilReady(containerId: string, token: string) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const { status, error_message } = await threadsApi<{ status?: string; error_message?: string }>(
      "GET",
      `/${containerId}`,
      { fields: "status,error_message" },
      token
    );
    if (status === "FINISHED" || status === "PUBLISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new PublishError(
        `Threads couldn't process this file${error_message ? ` (${error_message})` : ""}. Videos must be MP4 or MOV, up to 5 minutes.`
      );
    }
    await sleep(3000);
  }
  throw new PublishError("Threads is taking too long to process the media. Try again in a few minutes.");
}
