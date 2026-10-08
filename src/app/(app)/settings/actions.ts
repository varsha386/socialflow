"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// True for any time zone name this system knows, including older aliases
// like "Asia/Calcutta" that some browsers report instead of "Asia/Kolkata".
function isTimeZone(name: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

export type ProfileFormState = { error?: string; saved?: boolean };

// Runs on the server when the Settings form is submitted.
export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "");

  if (!fullName) return { error: "Enter your name" };
  if (fullName.length > 80) return { error: "Keep your name under 80 characters" };
  if (!isTimeZone(timezone)) return { error: "Choose a time zone from the list" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, timezone })
    .eq("id", user.id);
  if (error) return { error: "Couldn't save your changes. Try again." };

  // Refresh the sidebar and dashboard so they show the new name.
  revalidatePath("/", "layout");
  return { saved: true };
}

// Sets just the time zone (used by the "Use my time zone" buttons outside Settings).
export async function setTimezone(timezone: string): Promise<{ error?: string }> {
  if (!isTimeZone(timezone)) return { error: "That time zone isn't recognised." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  const { error } = await supabase.from("profiles").update({ timezone }).eq("id", user.id);
  if (error) return { error: "Couldn't save your time zone. Try again." };

  revalidatePath("/", "layout");
  return {};
}
