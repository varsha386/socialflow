"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Removes a connected account. Its saved tokens are deleted with it (ON DELETE CASCADE).
// Row Level Security means people can only delete their own accounts.
export async function disconnectAccount(accountId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("social_accounts").delete().eq("id", accountId);
  if (error) throw new Error("Couldn't disconnect that account. Try again.");
  revalidatePath("/connections");
  revalidatePath("/dashboard");
}
