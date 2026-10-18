// Choices for the AI Caption Writer, shared by the Create screen and the server.

export const TONES = ["friendly", "professional", "funny", "inspiring", "excited"] as const;
export type Tone = (typeof TONES)[number];

export const TONE_LABELS: Record<Tone, string> = {
  friendly: "Friendly",
  professional: "Professional",
  funny: "Funny",
  inspiring: "Inspiring",
  excited: "Excited",
};
