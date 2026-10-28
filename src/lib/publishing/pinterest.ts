import "server-only";
import { pinterestApi } from "@/lib/connectors/pinterest";
import { PublishError, type PublishJob, type PublishResult } from "./types";

// Creates a Pin on the chosen board: one photo, or a carousel of 2–5. Pinterest fetches the
// photos itself from their public addresses. The caption becomes the Pin's description.
// Docs: https://developers.pinterest.com/docs/api/v5/pins-create/

export async function publishToPinterest(job: PublishJob): Promise<PublishResult> {
  const { accessToken: token, caption, media, pinterest } = job;
  if (!pinterest.boardId) throw new PublishError("Choose a board for the Pin.");
  const images = media.filter((m) => m.kind === "image");
  if (images.length === 0) throw new PublishError("Every Pin needs a photo.");

  const mediaSource =
    images.length === 1
      ? { source_type: "image_url", url: images[0].url }
      : { source_type: "multiple_image_urls", items: images.map((m) => ({ url: m.url })), index: 0 };

  const pin = await pinterestApi<{ id: string }>("POST", "/pins", token, {
    board_id: pinterest.boardId,
    ...(pinterest.title.trim() ? { title: pinterest.title.trim() } : {}),
    ...(caption.trim() ? { description: caption } : {}),
    ...(pinterest.link.trim() ? { link: pinterest.link.trim() } : {}),
    media_source: mediaSource,
  });
  return { externalId: pin.id, url: `https://www.pinterest.com/pin/${pin.id}/` };
}
