// The social platforms Ripple can post to.
// `color` is each platform's brand color, used for small logo badges.
// `provider` is the login service used to connect it: Facebook and Instagram
// both connect through one Meta login.
// `connectWith` is how people connect it: a login window ("oauth"), or a form
// on the Connections page asking for an app password ("app-password").
export type PlatformId = "instagram" | "facebook" | "youtube" | "bluesky" | "threads" | "linkedin" | "pinterest";
export type ProviderId = "meta" | "youtube" | "bluesky" | "threads" | "linkedin" | "pinterest";

export type Platform = {
  id: PlatformId;
  name: string;
  short: string;
  color: string;
  description: string;
  provider: ProviderId;
  connectWith: "oauth" | "app-password";
};

export const PLATFORMS: Platform[] = [
  {
    id: "instagram",
    name: "Instagram",
    short: "IG",
    color: "#E1306C",
    description: "Needs a Business or Creator account linked to a Facebook Page.",
    provider: "meta",
    connectWith: "oauth",
  },
  {
    id: "facebook",
    name: "Facebook",
    short: "f",
    color: "#0866FF",
    description: "Posts to a Facebook Page you manage.",
    provider: "meta",
    connectWith: "oauth",
  },
  {
    id: "youtube",
    name: "YouTube",
    short: "YT",
    color: "#FF0000",
    description: "Video uploads and Shorts to your channel.",
    provider: "youtube",
    connectWith: "oauth",
  },
  {
    id: "threads",
    name: "Threads",
    short: "@",
    color: "#101010",
    description: "Text, photos, videos and carousels on your Threads profile.",
    provider: "threads",
    connectWith: "oauth",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    short: "in",
    color: "#0A66C2",
    description: "Text, photos or a video on your personal LinkedIn profile.",
    provider: "linkedin",
    connectWith: "oauth",
  },
  {
    id: "pinterest",
    name: "Pinterest",
    short: "P",
    color: "#E60023",
    description: "Photo Pins, or carousels of 2–5, on a board you choose.",
    provider: "pinterest",
    connectWith: "oauth",
  },
  {
    id: "bluesky",
    name: "Bluesky",
    short: "BS",
    color: "#0085FF",
    description: "Text posts with up to 4 photos. Connect with an app password.",
    provider: "bluesky",
    connectWith: "app-password",
  },
];

// Shown greyed out on the Connections page, so people know what's on the way.
export const COMING_SOON = ["X (Twitter)"];
