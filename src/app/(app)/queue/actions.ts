"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Adds the same posting time on each chosen weekday (1 = Monday ... 7 = Sunday).
// Times that are already in the queue are skipped.
export async function addQueueTimes(weekdays: number[], time: string): Promise<{ error?: string }> {
  const days = [...new Set(weekdays)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  if (days.length === 0) return { error: "Choose at least one day." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: "Choose a time." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("queue_slots")
    .upsert(
      days.map((weekday) => ({ weekday, time })),
      { onConflict: "user_id,weekday,time", ignoreDuplicates: true }
    );
  if (error) return { error: "Couldn't add the time. Try again." };

  revalidatePath("/queue");
  revalidatePath("/create");
  return {};
}

export async function deleteQueueTime(slotId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("queue_slots").delete().eq("id", slotId);
  if (error) return { error: "Couldn't remove the time. Try again." };

  revalidatePath("/queue");
  revalidatePath("/create");
  return {};
}
