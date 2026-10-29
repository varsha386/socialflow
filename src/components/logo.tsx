import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
      <RippleMark />
      Ripple
    </Link>
  );
}

// Rings spreading from a drop in the lower-left corner, as in src/app/icon.svg.
// The tile's rounded corners trim the outer rings, so no SVG clip ids are needed.
function RippleMark() {
  return (
    <span className="size-8 shrink-0 overflow-hidden rounded-xl bg-primary text-primary-foreground" aria-hidden="true">
      <svg viewBox="0 0 32 32" className="size-full" fill="none" stroke="currentColor" strokeWidth="3">
        <circle cx="9" cy="23" r="7" />
        <circle cx="9" cy="23" r="14" strokeOpacity="0.7" />
        <circle cx="9" cy="23" r="21" strokeOpacity="0.45" />
        <circle cx="9" cy="23" r="2.6" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}
