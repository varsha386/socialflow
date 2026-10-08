"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle, Play, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { mediaUrl } from "@/lib/media";
import type { MediaItem } from "@/lib/post-rules";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 50 * 1024 * 1024; // the storage bucket's limit
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime"];

type Uploading = { key: string; name: string; error?: string };

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

  async function uploadOne(original: File) {
    const key = crypto.randomUUID();
    const fail = (error: string) =>
      setUploading((u) => u.map((x) => (x.key === key ? { ...x, error } : x)));
    setUploading((u) => [...u, { key, name: original.name }]);

    if (!ACCEPTED.includes(original.type)) return fail("Use JPEG, PNG, WebP, GIF, MP4 or MOV.");
    if (original.size > MAX_BYTES) return fail("Files must be 50 MB or smaller.");

    try {
      const file = await toJpegIfNeeded(original);
      const { width, height, duration } = await readDimensions(file);
      const ext = file.type === "video/quicktime" ? "mov" : file.type.split("/")[1].replace("jpeg", "jpg");
      const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) return fail("Upload failed. Try again.");

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
        kind: file.type.startsWith("video/") ? "video" : "image",
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
        <span className="text-xs">JPEG, PNG, WebP, GIF, MP4 or MOV, up to 50 MB each</span>
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

      {(media.length > 0 || uploading.length > 0) && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {media.map((item, i) => (
            <div key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted">
              {item.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt="" className="size-full object-cover" />
              ) : (
                <>
                  <video src={item.url} muted preload="metadata" className="size-full object-cover" />
                  <Play className="absolute top-1/2 left-1/2 size-6 -translate-1/2 fill-white text-white drop-shadow" />
                </>
              )}
              <span className="absolute top-1 left-1 rounded-full bg-black/60 px-1.5 text-xs text-white">
                {i + 1}
              </span>
              <button
                type="button"
                onClick={() => onChange((current) => current.filter((m) => m.id !== item.id))}
                className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label="Remove"
              >
                <X className="size-3.5" />
              </button>
              {media.length > 1 && (
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
                  <LoaderCircle className="size-5 animate-spin" />
                  <span className="w-full truncate">{u.name}</span>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
