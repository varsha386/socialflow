"use client";

import { useRef, useState } from "react";
import * as tus from "tus-js-client";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, Play, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { mediaUrl } from "@/lib/media";
import type { MediaItem } from "@/lib/post-rules";
import { createClient } from "@/lib/supabase/client";
import { RESUMABLE_FROM_BYTES, UPLOAD_HINT, UPLOAD_LIMITS, formatMb } from "@/lib/upload-limits";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime"];

// progress: 0–1 for big files (resumable uploads report it), null while a small file uploads.
type Uploading = { key: string; name: string; progress: number | null; error?: string; cancel?: () => void };

// Instagram only accepts JPEG photos, so PNG/WebP are converted in the browser.
async function toJpegIfNeeded(file: File): Promise<File> {
  if (file.type !== "image/png" && file.type !== "image/webp") return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // transparent areas become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("convert"))), "image/jpeg", 0.92)
  );
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

async function readDimensions(file: File) {
  if (file.type.startsWith("image/")) {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, duration: null };
  }
  return new Promise<{ width: number | null; height: number | null; duration: number | null }>(
    (resolve) => {
      const video = document.createElement("video");
      const url = URL.createObjectURL(file);
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
        URL.revokeObjectURL(url);
      };
      video.onerror = () => {
        resolve({ width: null, height: null, duration: null });
        URL.revokeObjectURL(url);
      };
      video.src = url;
    }
  );
}

// Uploads a big file in 6 MB pieces with Supabase's resumable (TUS) upload, so a dropped
// connection continues where it stopped instead of starting over.
// Docs: https://supabase.com/docs/guides/storage/uploads/resumable-uploads
async function uploadResumable(
  file: File,
  storagePath: string,
  onProgress: (fraction: number) => void,
  onStart: (cancel: () => void) => void
) {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("not logged in");

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: "media", objectName: storagePath, contentType: file.type, cacheControl: "3600" },
      chunkSize: 6 * 1024 * 1024, // Supabase requires exactly 6 MB pieces
      onProgress: (sent, total) => onProgress(total ? sent / total : 0),
      onSuccess: () => resolve(),
      onError: (error) => reject(error),
    });
    onStart(() => {
      upload.abort(true).catch(() => {});
      reject(new Error("cancelled"));
    });
    upload.start();
  });
}

export function MediaUploader({
  userId,
  media,
  onChange,
}: {
  userId: string;
  media: MediaItem[];
  onChange: (update: (current: MediaItem[]) => MediaItem[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [dragging, setDragging] = useState(false);
  // "Select" mode: tick files, then remove them together.
  const [selecting, setSelecting] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);

  const toggleChosen = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const removeIds = (ids: string[]) => {
    onChange((current) => current.filter((m) => !ids.includes(m.id)));
    setChosen((c) => c.filter((id) => !ids.includes(id)));
  };
  const stopSelecting = () => {
    setSelecting(false);
    setChosen([]);
  };
  const cancellable = uploading.filter((u) => u.cancel && !u.error);

  async function uploadOne(original: File) {
    const key = crypto.randomUUID();
    const update = (patch: Partial<Uploading>) =>
      setUploading((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    const fail = (error: string) => update({ error, cancel: undefined });
    setUploading((u) => [...u, { key, name: original.name, progress: null }]);

    if (!ACCEPTED.includes(original.type)) return fail("Use JPEG, PNG, WebP, GIF, MP4 or MOV.");
    const isVideo = original.type.startsWith("video/");
    if (isVideo && original.size > UPLOAD_LIMITS.videoBytes) {
      return fail(`Videos must be ${formatMb(UPLOAD_LIMITS.videoBytes)} or smaller.`);
    }

    try {
      const file = await toJpegIfNeeded(original);
      // Photos are checked after converting, since the JPEG is often smaller than a PNG.
      if (!isVideo && file.size > UPLOAD_LIMITS.photoBytes) {
        return fail(`Photos must be ${formatMb(UPLOAD_LIMITS.photoBytes)} or smaller.`);
      }
      const { width, height, duration } = await readDimensions(file);
      if (isVideo && duration && duration > UPLOAD_LIMITS.videoSeconds + 0.5) {
        return fail(`Videos can be up to ${UPLOAD_LIMITS.videoSeconds / 60} minutes long.`);
      }
      const ext = file.type === "video/quicktime" ? "mov" : file.type.split("/")[1].replace("jpeg", "jpg");
      const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`;

      const supabase = createClient();
      if (file.size > RESUMABLE_FROM_BYTES) {
        update({ progress: 0 });
        try {
          await uploadResumable(
            file,
            storagePath,
            (progress) => update({ progress }),
            (cancel) => update({ cancel })
          );
        } catch (err) {
          if (err instanceof Error && err.message === "cancelled") {
            setUploading((u) => u.filter((x) => x.key !== key));
            return;
          }
          return fail("Upload failed. Check your connection and try again.");
        }
      } else {
        const { error: uploadError } = await supabase.storage
          .from("media")
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) return fail("Upload failed. Try again.");
      }

      const { data: row, error: rowError } = await supabase
        .from("media")
        .insert({
          storage_path: storagePath,
          mime_type: file.type,
          size_bytes: file.size,
          width,
          height,
          duration_seconds: duration,
        })
        .select("id")
        .single();
      if (rowError) return fail("Upload failed. Try again.");

      const item: MediaItem = {
        id: row.id,
        url: mediaUrl(storagePath),
        storagePath,
        mimeType: file.type,
        kind: isVideo ? "video" : "image",
        sizeBytes: file.size,
        width,
        height,
        durationSeconds: duration,
      };
      onChange((current) => [...current, item]);
      setUploading((u) => u.filter((x) => x.key !== key));
    } catch {
      fail("Couldn't read that file.");
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(uploadOne);
  }

  function move(index: number, by: -1 | 1) {
    onChange((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-card px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary/50",
          dragging && "border-primary bg-accent"
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Upload className="size-5" />
        </span>
        <span>
          <span className="font-medium text-foreground">Click to upload</span> or drag photos and videos here
        </span>
        <span className="text-xs">JPEG, PNG, WebP, GIF, MP4 or MOV · {UPLOAD_HINT}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {(media.length > 1 || selecting || cancellable.length > 1) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {media.length > 1 && !selecting && (
            <>
              <span className="text-muted-foreground">{media.length} files</span>
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => setSelecting(true)}>
                Select
              </button>
              <button
                type="button"
                className="font-medium text-destructive hover:underline"
                onClick={() => {
                  if (window.confirm(`Remove all ${media.length} files from this post?`)) removeIds(media.map((m) => m.id));
                }}
              >
                Remove all
              </button>
            </>
          )}
          {selecting && (
            <>
              <span className="text-muted-foreground" aria-live="polite">
                {chosen.length} selected
              </span>
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setChosen(chosen.length === media.length ? [] : media.map((m) => m.id))}
              >
                {chosen.length === media.length ? "Clear selection" : "Select all"}
              </button>
              <button
                type="button"
                disabled={chosen.length === 0}
                className="font-medium text-destructive hover:underline disabled:text-muted-foreground disabled:no-underline"
                onClick={() => {
                  removeIds(chosen);
                  stopSelecting();
                }}
              >
                Remove selected{chosen.length ? ` (${chosen.length})` : ""}
              </button>
              <button type="button" className="font-medium hover:underline" onClick={stopSelecting}>
                Done
              </button>
            </>
          )}
          {cancellable.length > 1 && (
            <button
              type="button"
              className="ml-auto font-medium text-destructive hover:underline"
              onClick={() => cancellable.forEach((u) => u.cancel?.())}
            >
              Cancel all uploads ({cancellable.length})
            </button>
          )}
        </div>
      )}

      {(media.length > 0 || uploading.length > 0) && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {media.map((item, i) => (
            <div
              key={item.id}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-xl bg-muted",
                selecting && chosen.includes(item.id) && "ring-3 ring-primary"
              )}
            >
              {selecting && (
                // While selecting, the whole tile ticks and unticks the file.
                <button
                  type="button"
                  onClick={() => toggleChosen(item.id)}
                  aria-pressed={chosen.includes(item.id)}
                  aria-label={`Select file ${i + 1}`}
                  className="absolute inset-0 z-10 flex items-start justify-start p-1.5"
                >
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full border-2 border-white text-white shadow",
                      chosen.includes(item.id) ? "bg-primary" : "bg-black/40"
                    )}
                  >
                    {chosen.includes(item.id) && <Check className="size-3.5" />}
                  </span>
                </button>
              )}
              {item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" className="size-full object-cover" />
              ) : (
                <>
                  <video src={item.url} muted preload="metadata" className="size-full object-cover" />
                  <Play className="absolute top-1/2 left-1/2 size-6 -translate-1/2 fill-white text-white drop-shadow" />
                </>
              )}
              {!selecting && (
                <>
                  <span className="absolute top-1 left-1 rounded-full bg-black/60 px-1.5 text-xs text-white">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeIds([item.id])}
                    className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                    aria-label={`Remove file ${i + 1}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              )}
              {media.length > 1 && !selecting && (
                <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white disabled:invisible"
                    aria-label="Move earlier"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    disabled={i === media.length - 1}
                    onClick={() => move(i, 1)}
                    className="flex size-6 items-center justify-center rounded-full bg-black/60 text-white disabled:invisible"
                    aria-label="Move later"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {uploading.map((u) => (
            <div
              key={u.key}
              className="relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl bg-muted p-2 text-center text-xs text-muted-foreground"
            >
              {u.error ? (
                <>
                  <span className="text-destructive">{u.error}</span>
                  <span className="w-full truncate">{u.name}</span>
                  <button
                    type="button"
                    onClick={() => setUploading((list) => list.filter((x) => x.key !== u.key))}
                    className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full hover:bg-background"
                    aria-label="Dismiss"
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              ) : (
                <>
                  {u.progress === null ? (
                    <LoaderCircle className="size-5 animate-spin" />
                  ) : (
                    <span className="text-sm font-medium text-foreground tabular-nums">
                      {Math.round(u.progress * 100)}%
                    </span>
                  )}
                  <span className="w-full truncate">{u.name}</span>
                  {u.progress !== null && (
                    <div
                      className="h-1.5 w-full overflow-hidden rounded-full bg-background"
                      role="progressbar"
                      aria-label={`Uploading ${u.name}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(u.progress * 100)}
                    >
                      <div className="h-full bg-primary transition-[width]" style={{ width: `${u.progress * 100}%` }} />
                    </div>
                  )}
                  {u.cancel && (
                    <button
                      type="button"
                      onClick={u.cancel}
                      className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full hover:bg-background"
                      aria-label={`Cancel uploading ${u.name}`}
                      title="Cancel"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
