"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
  if (!Intl.supportedValuesOf("timeZone").includes(timezone) && timezone !== "UTC") {
    return { error: "Choose a time zone from the list" };
  }

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
