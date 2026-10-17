"use server";

import { revalidatePath } from "next/cache";
import { BIO_LIMITS, HANDLE_PATTERN, bioPath, normalizeUrl, type BioPage } from "@/lib/bio";
import { createClient } from "@/lib/supabase/server";

type Result = { error?: string };

// Refreshes the editor and the public page after a change.
async function refresh(supabase: Awaited<ReturnType<typeof createClient>>, ...extraHandles: string[]) {
  revalidatePath("/bio");
  const { data } = await supabase.from("bio_pages").select("handle").maybeSingle();
  for (const handle of [data?.handle, ...extraHandles]) {
    if (handle) revalidatePath(bioPath(handle));
  }
}

export async function saveBioPage(input: BioPage): Promise<Result> {
  const handle = input.handle.trim().toLowerCase();
  const title = input.title.trim();
  const bio = input.bio.trim();
  if (!HANDLE_PATTERN.test(handle)) {
    return { error: "Your page name needs 3–30 lowercase letters, numbers or underscores (_)." };
  }
  if (title.length > BIO_LIMITS.title) return { error: `Keep the title under ${BIO_LIMITS.title} characters.` };
  if (bio.length > BIO_LIMITS.bio) return { error: `Keep the bio under ${BIO_LIMITS.bio} characters.` };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  const { data: before } = await supabase.from("bio_pages").select("handle").maybeSingle();
  const { error } = await supabase
    .from("bio_pages")
    .upsert({ user_id: user.id, handle, title, bio, published: input.published }, { onConflict: "user_id" });
  if (error) {
    // 23505 = unique_violation: someone else already has this handle.
    if (error.code === "23505") return { error: `“${handle}” is already taken. Try another page name.` };
    return { error: "Couldn't save your page. Try again." };
  }

  // The old address stops working when the handle changes, so refresh it too.
  await refresh(supabase, before?.handle ?? "");
  return {};
}

export async function addBioLink(title: string, url: string): Promise<Result> {
  const cleanTitle = title.trim();
  const cleanUrl = normalizeUrl(url);
  if (!cleanTitle) return { error: "Give the link a title." };
  if (cleanTitle.length > BIO_LIMITS.linkTitle) return { error: `Keep the title under ${BIO_LIMITS.linkTitle} characters.` };
  if (!cleanUrl) return { error: "That doesn't look like a web address. It should look like example.com/page." };

  const supabase = await createClient();
  const { data: existing, error: listError } = await supabase.from("bio_links").select("position");
  if (listError) return { error: "Couldn't add the link. Try again." };
  if (existing.length >= BIO_LIMITS.links) return { error: `You can have up to ${BIO_LIMITS.links} links.` };

  const position = Math.max(-1, ...existing.map((l) => l.position as number)) + 1;
  const { error } = await supabase.from("bio_links").insert({ title: cleanTitle, url: cleanUrl, position });
  if (error) return { error: "Couldn't add the link. Try again." };

  await refresh(supabase);
  return {};
}

export async function deleteBioLink(id: string): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.from("bio_links").delete().eq("id", id);
  if (error) return { error: "Couldn't remove the link. Try again." };
  await refresh(supabase);
  return {};
}

// Moves a link one place up or down, then saves every link's position as 0, 1, 2...
export async function moveBioLink(id: string, direction: "up" | "down"): Promise<Result> {
  const supabase = await createClient();
  const { data: links, error } = await supabase
    .from("bio_links")
    .select("id, position")
    .order("position")
    .order("created_at");
  if (error) return { error: "Couldn't move the link. Try again." };

  const order = links.map((l) => l.id as string);
  const from = order.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= order.length) return {};
  [order[from], order[to]] = [order[to], order[from]];

  const updates = order
    .map((linkId, position) => ({ linkId, position }))
    .filter(({ linkId, position }) => links.find((l) => l.id === linkId)!.position !== position);
  const results = await Promise.all(
    updates.map(({ linkId, position }) => supabase.from("bio_links").update({ position }).eq("id", linkId))
  );
  if (results.some((r) => r.error)) return { error: "Couldn't move the link. Try again." };

  await refresh(supabase);
  return {};
}
