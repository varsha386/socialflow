import "server-only";
import { PublishError, type PublishJob, type PublishResult } from "./types";

// Uploads a video to YouTube with a "resumable upload": first we tell YouTube
// about the video (title, description, privacy), then we send the file itself.
// Each upload costs 1,600 of the project's 10,000 daily quota units (about 6 uploads a day).
// Docs: https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol
export async function publishToYouTube(job: PublishJob): Promise<PublishResult> {
  const { accessToken: token, caption, media, youtube } = job;
  const video = media.find((m) => m.kind === "video");
  if (!video) throw new PublishError("YouTube needs a video.");

  // 1. Download the video from our storage.
  const fileRes = await fetch(video.url);
  if (!fileRes.ok) throw new PublishError("Couldn't read the video from storage.");
  const bytes = new Uint8Array(await fileRes.arrayBuffer());

  // 2. Start the upload with the video's details.
  const start = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": video.mimeType,
        "X-Upload-Content-Length": String(bytes.byteLength),
      },
      body: JSON.stringify({
        snippet: { title: youtube.title.trim(), description: caption, categoryId: "22" },
        status: { privacyStatus: youtube.privacy, selfDeclaredMadeForKids: false },
      }),
    }
  );
  if (!start.ok) throw await youtubeError(start);
  const uploadUrl = start.headers.get("location");
  if (!uploadUrl) throw new PublishError("YouTube didn't accept the upload. Try again.");

  // 3. Send the file.
  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": video.mimeType, "Content-Length": String(bytes.byteLength) },
    body: bytes,
  });
  if (!upload.ok) throw await youtubeError(upload);
  const { id } = (await upload.json()) as { id: string };

  return { externalId: id, url: `https://www.youtube.com/watch?v=${id}` };
}

async function youtubeError(res: Response): Promise<PublishError> {
  let reason = "";
  let message = "";
  try {
    const body = (await res.json()) as { error?: { message?: string; errors?: { reason?: string }[] } };
    reason = body.error?.errors?.[0]?.reason ?? "";
    message = body.error?.message ?? "";
  } catch {
    // Not JSON; fall through to the generic message.
  }
  if (res.status === 401) return new PublishError("YouTube needs you to reconnect your channel.", { reconnect: true });
  if (reason === "quotaExceeded" || reason === "uploadLimitExceeded") {
    return new PublishError("YouTube's daily upload limit for SocialFlow has been reached. Try again tomorrow.");
  }
  if (reason === "youtubeSignupRequired") return new PublishError("This Google account needs a YouTube channel first.");
  return new PublishError(message ? `YouTube: ${message}` : `YouTube returned error ${res.status}.`);
}
