// The email alerts a user can turn on or off in Settings (columns on profiles).

export const EMAIL_ALERTS = [
  {
    key: "email_on_failed",
    label: "A scheduled post failed",
    description: "When a post couldn't go out to one or more accounts, with the reason and a link to retry.",
  },
  {
    key: "email_on_reconnect",
    label: "An account needs reconnecting",
    description: "When Facebook, Instagram or YouTube stops accepting SocialFlow's login. Sent once, not every time.",
  },
  {
    key: "email_on_published",
    label: "A scheduled post went out",
    description: "When a scheduled post is published everywhere, with links to it.",
  },
] as const;

export type EmailAlert = (typeof EMAIL_ALERTS)[number]["key"];
export type EmailAlertSettings = Record<EmailAlert, boolean>;

// Used until the user changes anything (matches the database defaults).
export const DEFAULT_EMAIL_ALERTS: EmailAlertSettings = {
  email_on_failed: true,
  email_on_reconnect: true,
  email_on_published: false,
};
