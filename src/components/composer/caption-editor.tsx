"use client";

import { useRef, useState } from "react";
import { FaceSlightlySmilingPlus, Hash, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJIS = [
  "😀", "😂", "🥰", "😍", "😎", "🤩", "🥳", "😇", "🤔", "😅",
  "🙌", "👏", "👍", "🙏", "💪", "👉", "✌️", "🤝", "👀", "💯",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🔥", "✨", "⭐", "🌟",
  "🎉", "🎁", "📣", "📸", "🎥", "🎵", "☕", "🍕", "🌸", "🌈",
  "✅", "❗", "➡️", "📍", "🗓️", "⏰", "💡", "🚀", "📈", "🛒",
];

export type CaptionLimit = { label: string; max: number };

export function CaptionEditor({
  value,
  onChange,
  placeholder,
  limits,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  limits: CaptionLimit[];
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);

  // Inserts text where the cursor is (or replaces the selection), then
  // optionally selects part of the inserted text so the user can type over it.
  function insert(text: string, selectFrom?: number, selectTo?: number) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const a = start + (selectFrom ?? text.length);
      const b = start + (selectTo ?? text.length);
      el.setSelectionRange(a, b);
    });
  }

  function needsSpaceBefore() {
    const start = ref.current?.selectionStart ?? value.length;
    return start > 0 && !/\s/.test(value[start - 1]);
  }

  return (
    <div className="rounded-2xl border border-input bg-card focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={7}
        className="block w-full resize-y rounded-t-2xl bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
      />

      {showEmoji && (
        <div className="grid grid-cols-10 gap-1 border-t px-3 py-2">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => insert(emoji)}
              className="flex aspect-square items-center justify-center rounded-lg text-lg hover:bg-muted"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-2 py-1.5">
        <div className="flex items-center gap-1">
          <ToolButton label="Emoji" active={showEmoji} onClick={() => setShowEmoji((s) => !s)}>
            <FaceSlightlySmilingPlus className="size-4" />
          </ToolButton>
          <ToolButton
            label="Add a hashtag"
            onClick={() => (needsSpaceBefore() ? insert(" #") : insert("#"))}
          >
            <Hash className="size-4" />
          </ToolButton>
          <ToolButton
            label="Add a link"
            onClick={() => {
              // Inserts https://example.com with "example.com" selected, ready to type over.
              const prefix = needsSpaceBefore() ? " " : "";
              const text = `${prefix}https://example.com`;
              insert(text, prefix.length + 8, text.length);
            }}
          >
            <Link2 className="size-4" />
          </ToolButton>
        </div>

        <div className="flex flex-wrap gap-3 px-2 text-xs text-muted-foreground">
          {limits.map((limit) => (
            <span
              key={limit.label}
              className={cn(value.length > limit.max && "font-medium text-destructive")}
            >
              {limit.label} {value.length.toLocaleString()}/{limit.max.toLocaleString()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground",
        active && "bg-accent text-accent-foreground"
      )}
    >
      {children}
    </button>
  );
}
