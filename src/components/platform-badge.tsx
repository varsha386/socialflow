import type { Platform } from "@/lib/platforms";

// Small colored square with the platform's initials, standing in for its logo.
export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-white"
      style={{ backgroundColor: platform.color }}
      aria-hidden="true"
    >
      {platform.short}
    </span>
  );
}
