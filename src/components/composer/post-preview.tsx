"use client";

import { Bookmark, Ellipsis, Globe, Heart, MessageCircle, Play, Send, Share2, ThumbsUp } from "lucide-react";
import type { PlatformId } from "@/lib/platforms";
import type { MediaItem, YouTubeOptions } from "@/lib/post-rules";

type PreviewAccount = { name: string; username: string | null; avatarUrl: string | null };

// Simplified look-alikes of each platform, so you can see roughly how the post will appear.
export function PostPreview({
  platform,
  account,
  caption,
  media,
  youtube,
}: {
  platform: PlatformId;
  account: PreviewAccount;
  caption: string;
  media: MediaItem[];
  youtube: YouTubeOptions;
}) {
  if (platform === "instagram") return <InstagramPreview account={account} caption={caption} media={media} />;
  if (platform === "facebook") return <FacebookPreview account={account} caption={caption} media={media} />;
  return <YouTubePreview account={account} caption={caption} media={media} youtube={youtube} />;
}

function Avatar({ account, size = 32 }: { account: PreviewAccount; size?: number }) {
  return account.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={account.avatarUrl} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="rounded-full bg-accent" style={{ width: size, height: size }} />
  );
}

function MediaView({ item, className }: { item: MediaItem | undefined; className: string }) {
  if (!item) {
    return (
      <div className={`flex items-center justify-center bg-muted text-xs text-muted-foreground ${className}`}>
        No photo or video yet
      </div>
    );
  }
  if (item.kind === "video") {
    return (
      <div className={`relative bg-black ${className}`}>
        <video src={item.url} muted preload="metadata" className="size-full object-contain" />
        <Play className="absolute top-1/2 left-1/2 size-10 -translate-1/2 fill-white/90 text-white/90" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.url} alt="" className={`object-cover ${className}`} />;
}

function Caption({ text, className = "" }: { text: string; className?: string }) {
  // Highlights hashtags and links like the real apps do.
  const parts = text.split(/(#[\p{L}\p{N}_]+|https?:\/\/\S+)/gu);
  return (
    <p className={`break-words whitespace-pre-wrap ${className}`}>
      {parts.map((part, i) =>
        /^(#|https?:)/.test(part) ? (
          <span key={i} className="text-[#00376b]">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </p>
  );
}

function InstagramPreview({ account, caption, media }: { account: PreviewAccount; caption: string; media: MediaItem[] }) {
  const name = account.username ?? account.name;
  return (
    <div className="overflow-hidden rounded-2xl border bg-white text-[13px] text-black">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Avatar account={account} />
        <span className="flex-1 font-semibold">{name}</span>
        <Ellipsis className="size-4" />
      </div>
      <div className="relative">
        <MediaView item={media[0]} className="aspect-square w-full" />
        {media.length > 1 && (
          <span className="absolute top-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-xs text-white">
            1/{media.length}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 px-3 pt-2.5">
        <Heart className="size-5" />
        <MessageCircle className="size-5" />
        <Send className="size-5" />
        <Bookmark className="ml-auto size-5" />
      </div>
      <div className="px-3 pt-2 pb-3">
        {caption ? (
          <Caption text={caption} className="line-clamp-4" />
        ) : (
          <p className="text-neutral-400">Your caption will appear here</p>
        )}
      </div>
    </div>
  );
}

function FacebookPreview({ account, caption, media }: { account: PreviewAccount; caption: string; media: MediaItem[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white text-[13px] text-[#050505]">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Avatar account={account} size={36} />
        <div className="flex-1">
          <p className="font-semibold">{account.name}</p>
          <p className="flex items-center gap-1 text-xs text-[#65676b]">
            Just now · <Globe className="size-3" />
          </p>
        </div>
        <Ellipsis className="size-4 text-[#65676b]" />
      </div>
      {caption ? (
        <Caption text={caption} className="line-clamp-6 px-3 pb-2.5" />
      ) : (
        !media.length && <p className="px-3 pb-2.5 text-neutral-400">What&apos;s on your mind?</p>
      )}
      {media.length > 0 && (
        <div className={media.length > 1 ? "grid grid-cols-2 gap-0.5" : ""}>
          {media.slice(0, 4).map((item, i) => (
            <div key={item.id} className="relative">
              <MediaView item={item} className={media.length > 1 ? "aspect-square w-full" : "max-h-96 w-full"} />
              {i === 3 && media.length > 4 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-semibold text-white">
                  +{media.length - 4}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mx-3 flex justify-around border-t py-1.5 text-[#65676b]">
        <span className="flex items-center gap-1.5"><ThumbsUp className="size-4" /> Like</span>
        <span className="flex items-center gap-1.5"><MessageCircle className="size-4" /> Comment</span>
        <span className="flex items-center gap-1.5"><Share2 className="size-4" /> Share</span>
      </div>
    </div>
  );
}

function YouTubePreview({
  account,
  caption,
  media,
  youtube,
}: {
  account: PreviewAccount;
  caption: string;
  media: MediaItem[];
  youtube: YouTubeOptions;
}) {
  const video = media.find((m) => m.kind === "video");
  return (
    <div className="overflow-hidden rounded-2xl border bg-white text-[13px] text-[#0f0f0f]">
      <MediaView item={video} className="aspect-video w-full" />
      <div className="space-y-2 p-3">
        <p className="line-clamp-2 text-base font-semibold">
          {youtube.title || <span className="text-neutral-400">Your video title</span>}
        </p>
        <div className="flex items-center gap-2">
          <Avatar account={account} size={28} />
          <span className="font-medium">{account.name}</span>
          <span className="ml-auto rounded-full bg-neutral-100 px-2 py-0.5 text-xs capitalize text-neutral-600">
            {youtube.privacy}
          </span>
        </div>
        <div className="rounded-xl bg-neutral-100 p-2.5">
          {caption ? (
            <Caption text={caption} className="line-clamp-4" />
          ) : (
            <p className="text-neutral-400">Your description will appear here</p>
          )}
        </div>
      </div>
    </div>
  );
}
