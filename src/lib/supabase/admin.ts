import "server-only";
import { createClient } from "@supabase/supabase-js";

// Supabase client with the SECRET key. It skips Row Level Security, so it can
// read and write the social_account_tokens table. Only use it in server code,
// and always filter by the logged-in user's ID yourself.
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is missing from the environment.");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
