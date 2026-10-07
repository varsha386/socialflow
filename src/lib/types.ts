// TypeScript shapes of the database rows we use in the app.
// They match supabase/migrations/20261007000000_initial_schema.sql.

import type { PlatformId } from "@/lib/platforms";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string;
};

export type SocialAccount = {
  id: string;
  platform: PlatformId;
  platform_account_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  status: "connected" | "expired" | "error";
};

export type PostStatus =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "partially_published"
  | "failed";
