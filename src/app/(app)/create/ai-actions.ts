"use server";

import { TONES, type Tone } from "@/lib/ai/caption-options";
import { CaptionError, generateCaptions } from "@/lib/ai/captions";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { createClient } from "@/lib/supabase/server";

export type CaptionIdeasResult = { captions?: string[]; error?: string };

const MAX_DESCRIPTION = 1000;

// Writes three caption options with AI. Only for logged-in users, since every call costs money.
export async function writeCaptionIdeas(input: {
  description: string;
  tone: string;
  hashtags: boolean;
  platforms: string[];
  currentCaption: string;
}): Promise<CaptionIdeasResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  const description = input.description.trim();
  if (!description) return { error: "Describe what the post is about first." };
  if (description.length > MAX_DESCRIPTION) {
    return { error: `Keep the description under ${MAX_DESCRIPTION} characters.` };
  }

  // Don't trust the browser: keep only known tones and platforms.
  const tone: Tone = (TONES as readonly string[]).includes(input.tone) ? (input.tone as Tone) : "friendly";
  const platforms = PLATFORMS.map((p) => p.id).filter((id): id is PlatformId => input.platforms.includes(id));

  try {
    const captions = await generateCaptions({
      description,
      tone,
      hashtags: input.hashtags,
      platforms,
      currentCaption: input.currentCaption.slice(0, 5000),
    });
    return { captions };
  } catch (err) {
    if (err instanceof CaptionError) return { error: err.message };
    console.error("[ai-captions]", err);
    return { error: "Couldn't write captions. Try again." };
  }
}
