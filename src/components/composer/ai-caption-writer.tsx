"use client";

import { useState, useTransition } from "react";
import { Check, LoaderCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { writeCaptionIdeas } from "@/app/(app)/create/ai-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TONES, TONE_LABELS, type Tone } from "@/lib/ai/caption-options";
import type { PlatformId } from "@/lib/platforms";
import { cn } from "@/lib/utils";

// "Write with AI": describe the post, pick a tone, get three captions to choose from.
export function AiCaptionWriter({
  platforms,
  currentCaption,
  target,
  onUse,
}: {
  platforms: PlatformId[];
  currentCaption: string;
  target: string; // where "Use this" puts it, e.g. "the main caption" or "Instagram"
  onUse: (caption: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState<Tone>("friendly");
  const [hashtags, setHashtags] = useState(true);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [used, setUsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    setUsed(null);
    startTransition(async () => {
      const result = await writeCaptionIdeas({ description, tone, hashtags, platforms, currentCaption });
      if (result.error) setError(result.error);
      setIdeas(result.captions ?? []);
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Sparkles />
        Write with AI
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-primary/30 bg-accent/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="size-4 text-primary" />
          Write with AI
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
          aria-label="Close AI caption writer"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-description">What&apos;s the post about?</Label>
        <textarea
          id="ai-description"
          value={description}
          onChange={(e) => {
            setError(null);
            setDescription(e.target.value);
          }}
          maxLength={1000}
          rows={3}
          placeholder="e.g. New chocolate cake at our bakery, 20% off this weekend only"
          className="w-full resize-none rounded-lg border border-input bg-card px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {currentCaption.trim() && (
          <p className="text-xs text-muted-foreground">Your current caption will be used as a starting point.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tone">
        {TONES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tone === t}
            onClick={() => setTone(t)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              tone === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {TONE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hashtags}
            onChange={(e) => setHashtags(e.target.checked)}
            className="size-4 accent-(--primary)"
          />
          Add hashtags
        </label>
        <Button size="sm" className="ml-auto" onClick={generate} disabled={pending || !description.trim()}>
          {pending ? <LoaderCircle className="animate-spin" /> : ideas.length ? <RefreshCw /> : <Sparkles />}
          {pending ? "Writing…" : ideas.length ? "Try again" : "Write captions"}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {ideas.length > 0 && (
        <ul className="space-y-2">
          {ideas.map((idea, i) => (
            <li key={i} className="rounded-xl bg-card p-3 ring-1 ring-border">
              <p className="text-sm break-words whitespace-pre-wrap">{idea}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground tabular-nums">{idea.length} characters</span>
                <Button
                  size="sm"
                  variant={used === i ? "secondary" : "outline"}
                  onClick={() => {
                    onUse(idea);
                    setUsed(i);
                  }}
                >
                  {used === i && <Check />}
                  {used === i ? "Used" : "Use this"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        &ldquo;Use this&rdquo; replaces {target}. AI can make mistakes, so check the details before posting.
      </p>
    </div>
  );
}
