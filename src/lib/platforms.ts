// The social platforms SocialFlow can post to.
// `color` is each platform's brand color, used for small logo badges.
// `provider` is the login service used to connect it: Facebook and Instagram
// both connect through one Meta login.
export type PlatformId = "instagram" | "facebook" | "youtube";
export type ProviderId = "meta" | "youtube";

export type Platform = {
  id: PlatformId;
  name: string;
  short: string;
  color: string;
  description: string;
  provider: ProviderId;
};

export const PLATFORMS: Platform[] = [
  {
    id: "instagram",
    name: "Instagram",
    short: "IG",
    color: "#E1306C",
    description: "Needs a Business or Creator account linked to a Facebook Page.",
    provider: "meta",
  },
  {
    id: "facebook",
    name: "Facebook",
    short: "f",
    color: "#0866FF",
    description: "Posts to a Facebook Page you manage.",
    provider: "meta",
  },
  {
    id: "youtube",
    name: "YouTube",
    short: "YT",
    color: "#FF0000",
    description: "Video uploads and Shorts to your channel.",
    provider: "youtube",
  },
];
