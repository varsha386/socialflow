// Link-in-bio: one public page per user at /u/<handle>, with a list of links.

export type BioPage = { handle: string; title: string; bio: string; published: boolean };
export type BioLink = { id: string; title: string; url: string };

export const BIO_LIMITS = { title: 60, bio: 160, linkTitle: 60, url: 2000, links: 30 };

// Lowercase letters, numbers and underscores, 3-30 long (the database checks this too).
export const HANDLE_PATTERN = /^[a-z0-9_]{3,30}$/;

export const bioPath = (handle: string) => `/u/${handle}`;

// Turns what someone typed into a safe web address, or null if it isn't one.
// Only http and https are allowed, so a "javascript:" link can't run code on the page.
export function normalizeUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null; // "https://hello" is almost always a typo
    const result = url.toString();
    return result.length <= BIO_LIMITS.url ? result : null;
  } catch {
    return null;
  }
}

// A starting handle from someone's name or email, e.g. "Ayisha Taslim" -> "ayisha_taslim".
export function suggestHandle(name: string, email: string) {
  const from = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30);
  const handle = from(name) || from(email.split("@")[0]);
  return handle.length >= 3 ? handle : `${handle}_page`.slice(0, 30);
}
