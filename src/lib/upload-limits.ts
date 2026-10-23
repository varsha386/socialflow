// How big photos and videos may be. Used by Create post and Bulk upload.
//
// Videos: Supabase's free plan stores files of up to 50 MB. On Supabase Pro, set
// NEXT_PUBLIC_MAX_VIDEO_MB=500 (in .env.local and on Vercel) and run
// supabase/migrations/20261023100000_bigger_uploads.sql to raise the storage limit too.

const MB = 1024 * 1024;

const videoMb = Number(process.env.NEXT_PUBLIC_MAX_VIDEO_MB) || 50;

export const UPLOAD_LIMITS = {
  photoBytes: 8 * MB, // Instagram's largest photo
  videoBytes: videoMb * MB,
  videoSeconds: 5 * 60,
};

// Files bigger than this upload in resumable 6 MB pieces, with a progress bar
// (Supabase's recommended way for anything over 6 MB).
export const RESUMABLE_FROM_BYTES = 6 * MB;

export const formatMb = (bytes: number) => `${Math.round(bytes / MB)} MB`;

// One line for the upload box, e.g. "Photos up to 8 MB · videos up to 50 MB and 5 minutes".
export const UPLOAD_HINT = `Photos up to ${formatMb(UPLOAD_LIMITS.photoBytes)} · videos up to ${formatMb(
  UPLOAD_LIMITS.videoBytes
)} and ${UPLOAD_LIMITS.videoSeconds / 60} minutes`;
