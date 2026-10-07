// The social platforms SocialFlow can post to.
// `color` is each platform's brand color, used for small logo badges.
export type PlatformId =
  | "bluesky"
  | "linkedin"
  | "youtube"
  | "facebook"
  | "instagram";

export type Platform = {
  id: PlatformId;
  name: string;
  short: string;
  color: string;
  description: string;
};

export const PLATFORMS: Platform[] = [
  {
    id: "bluesky",
    name: "Bluesky",
    short: "Bs",
    color: "#1185FE",
    description: "Text posts with up to 4 images or 1 video.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    short: "in",
    color: "#0A66C2",
    description: "Posts to your personal profile.",
  },
  {
    id: "youtube",
    name: "YouTube",
    short: "YT",
    color: "#FF0000",
    description: "Video uploads and Shorts.",
  },
  {
    id: "facebook",
    name: "Facebook",
    short: "f",
    color: "#0866FF",
    description: "Posts to a Facebook Page you manage.",
  },
  {
    id: "instagram",
    name: "Instagram",
    short: "IG",
    color: "#E1306C",
    description: "Needs a Business or Creator account.",
  },
];
