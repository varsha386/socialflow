// The public web address of an uploaded file in the "media" storage bucket.
// Works in both server and browser code.
export function mediaUrl(storagePath: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${storagePath}`;
}
