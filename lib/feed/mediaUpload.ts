"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mediaKind, mediaPath, extForMime, type PostMedia } from "./media";
import { readVideoDuration } from "@/lib/media/readVideoDuration";
import { extractPosterFrame } from "@/lib/media/extractPosterFrame";

// BL-SOCIAL-02 §4.3 — client-side media prep + upload to the private post-media
// bucket. The path's first segment is the uploader id (storage RLS keys on it).
// Video duration comes from the container bytes (D-042, lib/media/readVideoDuration);
// the poster is the video's own frame (lib/media/extractPosterFrame). A video whose
// duration is unreadable is rejected here (fail closed), never uploaded.
export const POST_MEDIA_BUCKET = "post-media";
const MAX_IMAGE_DIM = 2000;

export type MediaStage = "queued" | "processing" | "uploading" | "done" | "error";

// Read an image's natural dimensions, downscaling large non-animated images to
// MAX_IMAGE_DIM on the long edge. GIFs pass through untouched (a canvas re-encode
// would flatten the animation), only their dimensions are read.
async function prepImage(file: File): Promise<{ blob: Blob; w: number; h: number }> {
  if (typeof createImageBitmap !== "function") return { blob: file, w: 0, h: 0 };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { blob: file, w: 0, h: 0 };
  }
  const { width, height } = bitmap;
  const longest = Math.max(width, height);
  if (file.type === "image/gif" || longest <= MAX_IMAGE_DIM) {
    bitmap.close();
    return { blob: file, w: width, h: height };
  }
  const scale = MAX_IMAGE_DIM / longest;
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return { blob: file, w: width, h: height };
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob: Blob = await new Promise((res) =>
    canvas.toBlob((b) => res(b ?? file), file.type, 0.9),
  );
  return { blob, w, h };
}

async function uploadBlob(
  supabase: SupabaseClient,
  path: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
}

// Prepare + upload one file, returning a PostMedia descriptor to embed in
// posts.media. Throws on any failure so the caller can clean up + surface it.
export async function uploadPostMediaFile(
  supabase: SupabaseClient,
  uid: string,
  file: File,
  onStage?: (s: MediaStage) => void,
): Promise<PostMedia> {
  const kind = mediaKind(file.type);
  if (!kind) throw new Error("unsupported-type");
  const uuid = crypto.randomUUID();

  if (kind === "image") {
    onStage?.("processing");
    const { blob, w, h } = await prepImage(file);
    const path = mediaPath(uid, uuid, extForMime(file.type));
    onStage?.("uploading");
    await uploadBlob(supabase, path, blob, file.type);
    onStage?.("done");
    return { type: "image", path, mime: file.type, bytes: blob.size, w, h };
  }

  // video — duration from the container bytes (D-042), poster from a real frame.
  onStage?.("processing");
  const dur = await readVideoDuration(file);
  if (!dur.ok) throw new Error("video-meta-failed"); // duration unreadable → fail closed
  const durationMs = Math.round(dur.seconds * 1000);
  // validate_post_media() requires a poster_path for a video, so a null poster
  // blocks THIS video (surfaced as an error). Scaled poster dims preserve the
  // video's aspect ratio, which is all PostMedia rendering needs.
  const poster = await extractPosterFrame(file);
  if (!poster) throw new Error("poster-failed");
  const path = mediaPath(uid, uuid, extForMime(file.type));
  const posterPath = mediaPath(uid, `${uuid}-poster`, "jpg");
  onStage?.("uploading");
  await uploadBlob(supabase, posterPath, poster.blob, "image/jpeg");
  await uploadBlob(supabase, path, file, file.type);
  onStage?.("done");
  return {
    type: "video",
    path,
    mime: file.type,
    bytes: file.size,
    duration_ms: durationMs,
    poster_path: posterPath,
    w: poster.width,
    h: poster.height,
  };
}

// Orphan cleanup: remove uploaded objects when the post insert fails (§4.3).
export async function deletePostMediaObjects(
  supabase: SupabaseClient,
  media: PostMedia[],
): Promise<void> {
  const paths = media.flatMap((m) =>
    m.type === "video" ? [m.path, m.poster_path] : [m.path],
  );
  if (paths.length === 0) return;
  try {
    await supabase.storage.from(POST_MEDIA_BUCKET).remove(paths);
  } catch {
    // best-effort — a leftover object is harmless (private bucket, unreferenced)
  }
}

// Collect every storage path in a page of media (images + video posters) for one
// batched signed-URL request.
export function collectMediaPaths(media: PostMedia[]): string[] {
  return media.flatMap((m) =>
    m.type === "video" ? [m.path, m.poster_path] : [m.path],
  );
}

// Fetch signed URLs for a page of media paths in ONE server round-trip (§4.4).
export async function fetchSignedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  try {
    const res = await fetch("/api/posts/media", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paths }),
    });
    if (!res.ok) return {};
    const json = (await res.json()) as { urls?: Record<string, string> };
    return json.urls ?? {};
  } catch {
    return {};
  }
}
