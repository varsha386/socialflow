import "server-only";
import { linkedinError, linkedinFetch } from "@/lib/connectors/linkedin";
import type { MediaItem } from "@/lib/post-rules";
import { sleep } from "./graph";
import { PublishError, type PublishJob, type PublishResult } from "./types";

// Publishes to a personal LinkedIn profile: text, one photo, 2–20 photos, or one video.
// Photos and videos are uploaded to LinkedIn first (videos in 4 MB parts), then the post
// refers to them by ID.
// Docs: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api

export async function publishToLinkedIn(job: PublishJob): Promise<PublishResult> {
  const { platformAccountId, accessToken: token, caption, media } = job;
  const owner = `urn:li:person:${platformAccountId}`;

  let content: Record<string, unknown> | undefined;
  const video = media.find((m) => m.kind === "video");
  if (video) {
    content = { media: { id: await uploadVideo(owner, video, token) } };
  } else if (media.length === 1) {
    content = { media: { id: await uploadImage(owner, media[0], token) } };
  } else if (media.length > 1) {
    const images: { id: string }[] = [];
    for (const item of media) images.push({ id: await uploadImage(owner, item, token) });
    content = { multiImage: { images } };
  }

  const post = {
    author: owner,
    commentary: escapeLittleText(caption),
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
    ...(content ? { content } : {}),
  };

  // A video is processed after it's uploaded, and LinkedIn may refuse the post until it's
  // ready. Tries every 5 seconds, for up to about 2 minutes.
  for (let attempt = 0; ; attempt++) {
    const res = await linkedinFetch("POST", "/posts", token, post);
    if (res.ok) {
      const id = res.headers.get("x-restli-id");
      if (!id) throw new PublishError("LinkedIn didn't confirm the post. Check your profile before trying again.");
      return { externalId: id, url: `https://www.linkedin.com/feed/update/${id}/` };
    }
    const stillProcessing = res.status === 400 && /WAITING_UPLOAD|PROCESSING/.test(await res.clone().text());
    if (!stillProcessing || attempt >= 24) throw await linkedinError(res);
    await sleep(5000);
  }
}

// LinkedIn reads post text in its "little" format, where these characters have special
// meanings; unescaped, the text after them can go missing. A # that starts a hashtag stays as it is.
// Docs: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format
function escapeLittleText(text: string) {
  return text.replace(/[\\|{}@[\]()<>*_~]|#(?![\p{L}\p{N}_])/gu, (c) => `\\${c}`);
}

async function download(item: MediaItem) {
  const res = await fetch(item.url);
  if (!res.ok) throw new PublishError("Couldn't read a file from storage.");
  return new Uint8Array(await res.arrayBuffer());
}

async function uploadImage(owner: string, item: MediaItem, token: string) {
  const init = await linkedinFetch("POST", "/images?action=initializeUpload", token, {
    initializeUploadRequest: { owner },
  });
  if (!init.ok) throw await linkedinError(init);
  const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } };

  const put = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: await download(item),
  });
  if (!put.ok) throw new PublishError("LinkedIn didn't accept a photo. Use JPG, PNG or GIF.");
  return value.image;
}

async function uploadVideo(owner: string, item: MediaItem, token: string) {
  const bytes = await download(item);
  const init = await linkedinFetch("POST", "/videos?action=initializeUpload", token, {
    initializeUploadRequest: { owner, fileSizeBytes: bytes.byteLength, uploadCaptions: false, uploadThumbnail: false },
  });
  if (!init.ok) throw await linkedinError(init);
  const { value } = (await init.json()) as {
    value: { video: string; uploadToken: string; uploadInstructions: { uploadUrl: string; firstByte: number; lastByte: number }[] };
  };

  // LinkedIn says which bytes go to which address (4 MB each), and returns an ETag per part.
  const partIds: string[] = [];
  for (const part of value.uploadInstructions) {
    const res = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: bytes.subarray(part.firstByte, part.lastByte + 1),
    });
    const etag = res.headers.get("etag");
    if (!res.ok || !etag) throw new PublishError("Uploading the video to LinkedIn failed. Try again.");
    partIds.push(etag);
  }

  const done = await linkedinFetch("POST", "/videos?action=finalizeUpload", token, {
    finalizeUploadRequest: { video: value.video, uploadToken: value.uploadToken, uploadedPartIds: partIds },
  });
  if (!done.ok) throw await linkedinError(done);
  return value.video;
}
