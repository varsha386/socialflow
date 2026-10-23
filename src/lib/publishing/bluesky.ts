import "server-only";
import { RichText } from "@atproto/api";
import sharp from "sharp";
import { blueskyLogin } from "@/lib/connectors/bluesky";
import { PublishError, type PublishJob, type PublishResult } from "./types";

// Publishes a text post with up to 4 photos to Bluesky.
// Docs: https://docs.bsky.app/docs/advanced-guides/posts

// Bluesky refuses images over 1,000,000 bytes; this leaves a little room.
const MAX_IMAGE_BYTES = 950_000;

// Shrinks a photo until it fits Bluesky's size limit, keeping it as large as possible.
// `mimeType` is null when the photo is unchanged, or "image/jpeg" after shrinking.
async function fitImage(
  input: Buffer
): Promise<{ data: Buffer; width: number; height: number; mimeType: string | null }> {
  if (input.length <= MAX_IMAGE_BYTES) {
    const meta = await sharp(input).metadata();
    return { data: input, width: meta.width ?? 0, height: meta.height ?? 0, mimeType: null };
  }
  for (const [size, quality] of [
    [2000, 85],
    [1600, 80],
    [1200, 75],
    [1000, 70],
  ] as const) {
    const { data, info } = await sharp(input)
      .rotate() // respect the photo's orientation before resizing
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer({ resolveWithObject: true });
    if (data.length <= MAX_IMAGE_BYTES) return { data, width: info.width, height: info.height, mimeType: "image/jpeg" };
  }
  throw new PublishError("A photo is too large for Bluesky even after shrinking it. Try a smaller photo.");
}

export async function publishToBluesky(job: PublishJob): Promise<PublishResult> {
  const agent = await blueskyLogin(job.platformAccountId, job.accessToken);

  // Turns links, #hashtags and @mentions into clickable parts of the post.
  const text = new RichText({ text: job.caption });
  await text.detectFacets(agent);

  const images = [];
  for (const item of job.media.filter((m) => m.kind === "image").slice(0, 4)) {
    const res = await fetch(item.url);
    if (!res.ok) throw new PublishError("Couldn't read one of the photos. Try uploading it again.");
    const { data, width, height, mimeType } = await fitImage(Buffer.from(await res.arrayBuffer()));
    const { data: blob } = await agent.uploadBlob(new Uint8Array(data), { encoding: mimeType ?? item.mimeType });
    images.push({ image: blob.blob, alt: "", ...(width && height ? { aspectRatio: { width, height } } : {}) });
  }

  try {
    const { uri } = await agent.post({
      text: text.text,
      facets: text.facets,
      ...(images.length ? { embed: { $type: "app.bsky.embed.images", images } } : {}),
    });
    // at://did:plc:…/app.bsky.feed.post/<id>  ->  https://bsky.app/profile/did:plc:…/post/<id>
    const [, , did, , rkey] = uri.split("/");
    return { externalId: uri, url: `https://bsky.app/profile/${did}/post/${rkey}` };
  } catch (err) {
    console.error("[bluesky] post failed:", err);
    throw new PublishError("Bluesky didn't accept the post. Try again.");
  }
}
