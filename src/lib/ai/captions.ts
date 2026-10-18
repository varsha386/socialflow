import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { Tone } from "@/lib/ai/caption-options";
import { PLATFORMS, type PlatformId } from "@/lib/platforms";
import { CAPTION_LIMITS } from "@/lib/post-rules";

// AI Caption Writer: asks Claude for three caption options for a post.
// Docs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs

const MODEL = "claude-opus-5-5";

export type CaptionRequest = {
  description: string; // what the post is about, in the user's words
  tone: Tone;
  hashtags: boolean;
  platforms: PlatformId[]; // where it will be posted
  currentCaption?: string; // a draft to improve, if they've started one
};

// Claude must answer with exactly this JSON shape.
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    captions: {
      type: "array",
      items: { type: "string" },
      description: "Three different caption options, best first.",
    },
  },
  required: ["captions"],
  additionalProperties: false,
};

// The fixed instructions. Kept the same for every request (nothing personal or
// time-based in here), so they can be cached by the API.
const SYSTEM_PROMPT = `You write social media captions for small creators and businesses who use SocialFlow to post to Instagram, Facebook and YouTube.

Write three captions that are clearly different from each other (for example: one short and punchy, one a little longer with more detail, one that ends with a question or call to action). Each caption must stand on its own and be ready to post.

Rules:
- Write in the same language the user writes in.
- Use only facts the user gave you. Don't invent prices, dates, names, places, offers or claims.
- Match the requested tone.
- Emoji are welcome where they fit the tone, but don't overdo them.
- Only add hashtags when asked. When asked, put 3-6 relevant hashtags at the end.
- Keep every caption under the character limit you are given.
- Return only the captions, with no labels like "Option 1" and no quotation marks around them.`;

// The friendly error to show when generation fails.
export class CaptionError extends Error {}

export async function generateCaptions(input: CaptionRequest): Promise<string[]> {
  // The shortest limit among the chosen platforms, with room to spare.
  const limit = Math.min(
    2000,
    ...input.platforms.map((p) => CAPTION_LIMITS[p]).filter((n) => Number.isFinite(n))
  );
  const platformNames = input.platforms.length
    ? input.platforms.map((p) => PLATFORMS.find((x) => x.id === p)?.name ?? p).join(", ")
    : "Instagram, Facebook and YouTube";

  const request = [
    `Platforms: ${platformNames}`,
    `Tone: ${input.tone}`,
    `Hashtags: ${input.hashtags ? "yes" : "no"}`,
    `Character limit per caption: ${limit}`,
    "",
    "What the post is about:",
    input.description,
    ...(input.currentCaption?.trim()
      ? ["", "Their draft caption so far (improve on it, keep its facts):", input.currentCaption.trim()]
      : []),
  ].join("\n");

  let response: Anthropic.Beta.BetaMessage;
  try {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: request }],
      output_config: {
        effort: "low", // short creative writing doesn't need deep reasoning
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      // If a safety filter wrongly declines a harmless request, retry it on
      // Anthropic's recommended fallback model instead of failing.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
  } catch (err) {
    // No key at all: the client can't even start, so this isn't an API error.
    if (err instanceof Anthropic.AuthenticationError || (!(err instanceof Anthropic.APIError) && !process.env.ANTHROPIC_API_KEY)) {
      throw new CaptionError("AI captions aren't set up yet: the Anthropic API key is missing or wrong.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new CaptionError("Too many AI requests right now. Wait a minute and try again.");
    }
    if (err instanceof Anthropic.APIConnectionError || (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500)) {
      throw new CaptionError("The AI service isn't reachable right now. Try again in a moment.");
    }
    console.error("[ai-captions] request failed:", err);
    throw new CaptionError("Couldn't write captions. Try again.");
  }

  if (response.stop_reason === "refusal") {
    throw new CaptionError("The AI couldn't write captions for this. Try describing the post differently.");
  }

  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  try {
    const parsed = JSON.parse(text) as { captions?: unknown };
    const captions = Array.isArray(parsed.captions)
      ? parsed.captions.filter((c): c is string => typeof c === "string" && c.trim() !== "").map((c) => c.trim())
      : [];
    if (captions.length === 0) throw new Error("no captions in the response");
    return captions.slice(0, 3).map((c) => c.slice(0, limit));
  } catch (err) {
    console.error("[ai-captions] unexpected response:", response.stop_reason, err);
    throw new CaptionError("Couldn't write captions. Try again.");
  }
}
