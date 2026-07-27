"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mediaKind,
  mediaPath,
  extForMime,
  guardMeta,
  generatePoster,
  type PostMedia,
  type VideoMeta,
} from "./media";

// BL-SOCIAL-02 §4.3 — client-side media prep + upload to the private post-media
// bucket. The path's first segment is the uploader id (storage RLS keys on it).
// Metadata/poster generation fails CLOSED — a video whose metadata never loads is
// rejected, never uploaded posterless.
export const POST_MEDIA_BUCKET = "post-media";
const MAX_IMAGE_DIM = 2000;
const META_TIMEOUT_MS = 10_000;

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

// Real <video> metadata loader, guarded by a timeout so a stuck decode fails closed.
async function loadVideoMeta(file: Blob): Promise<VideoMeta | null> {
  const read = new Promise<VideoMeta>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => {
      const meta = {
        durationMs: Math.round((v.duration || 0) * 1000),
        width: v.videoWidth,
        height: v.videoHeight,
      };
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("video metadata error"));
    };
    v.src = url;
  });
  return guardMeta(read, META_TIMEOUT_MS);
}

// Draw a frame ~1s in (or the midpoint of a short clip) to a canvas → webp blob.
async function capturePoster(file: Blob, meta: VideoMeta): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    const done = (b: Blob | null) => {
      URL.revokeObjectURL(url);
      resolve(b);
    };
    v.onloadeddata = () => {
      const at = Math.min(1, (meta.durationMs / 1000) / 2 || 0);
      try {
        v.currentTime = at;
      } catch {
        done(null);
      }
    };
    v.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = meta.width || v.videoWidth;
      canvas.height = meta.height || v.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return done(null);
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => done(b), "image/webp", 0.8);
    };
    v.onerror = () => done(null);
    v.src = url;
  });
}

// Read a pre-upload candidate for validateMediaSelection: mime + bytes, plus the
// video duration (via metadata) so an over-length clip is rejected BEFORE upload.
// A video whose metadata never loads returns durationMs undefined → invalid.
export async function readMediaCandidate(
  file: File,
): Promise<{ mime: string; bytes: number; durationMs?: number }> {
  if (mediaKind(file.type) === "video") {
    const meta = await loadVideoMeta(file);
    return { mime: file.type, bytes: file.size, durationMs: meta?.durationMs };
  }
  return { mime: file.type, bytes: file.size };
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

  // video
  onStage?.("processing");
  const meta = await loadVideoMeta(file);
  if (!meta) throw new Error("video-meta-failed"); // fail closed
  const poster = await generatePoster(file, { loadMeta: async () => meta, capture: capturePoster });
  if (!poster) throw new Error("poster-failed"); // a video without a poster is rejected
  const path = mediaPath(uid, uuid, extForMime(file.type));
  const posterPath = mediaPath(uid, `${uuid}-poster`, "webp");
  onStage?.("uploading");
  await uploadBlob(supabase, posterPath, poster, "image/webp");
  await uploadBlob(supabase, path, file, file.type);
  onStage?.("done");
  return {
    type: "video",
    path,
    mime: file.type,
    bytes: file.size,
    duration_ms: meta.durationMs,
    poster_path: posterPath,
    w: meta.width,
    h: meta.height,
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
