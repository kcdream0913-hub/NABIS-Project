"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mediaKind,
  mediaPath,
  extForMime,
  guardMeta,
  parseMp4DurationMs,
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

// Append a muted, off-screen <video> to the DOM. DETACHED media elements can fail
// to fire seek/timeupdate events reliably — the root cause of the duration read
// never resolving in live QA — so we attach it and remove it on cleanup.
function makeHiddenVideo(url: string): HTMLVideoElement {
  const v = document.createElement("video");
  v.preload = "metadata";
  v.muted = true;
  v.playsInline = true;
  v.setAttribute("aria-hidden", "true");
  v.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(v);
  v.src = url;
  return v;
}

// <video>-based duration read — the FALLBACK (webm / MP4 parse miss). DOM-attached
// and listens for every event that can carry a resolved duration; if duration is
// non-finite at loadedmetadata (the Infinity quirk), seek past the end to force the
// browser to compute it. durationMs 0 means "couldn't read".
async function loadVideoMeta(file: Blob): Promise<VideoMeta | null> {
  const read = new Promise<VideoMeta>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = makeHiddenVideo(url);
    let settled = false;
    const finish = (durationSec: number) => {
      if (settled) return;
      settled = true;
      const width = v.videoWidth;
      const height = v.videoHeight;
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      v.load();
      v.remove();
      const durationMs = Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec * 1000) : 0;
      resolve({ durationMs, width, height });
    };
    const tryResolve = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) finish(v.duration);
    };
    v.onloadedmetadata = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) {
        finish(v.duration);
        return;
      }
      v.addEventListener("durationchange", tryResolve);
      v.addEventListener("timeupdate", tryResolve);
      v.addEventListener("seeked", tryResolve);
      try {
        v.currentTime = 1e101;
      } catch {
        finish(Number.NaN);
      }
    };
    v.onerror = () => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      v.remove();
      reject(new Error("video metadata error"));
    };
  });
  return guardMeta(read, META_TIMEOUT_MS);
}

// Duration in ms — PRIMARY path is the deterministic MP4/MOV container parse (no
// DOM/blob/CSP/event dependency), falling back to the <video> element for webm or
// a parse miss. Returns null when we truly can't read it.
export async function readVideoDurationMs(file: File): Promise<number | null> {
  if (file.type === "video/mp4" || file.type === "video/quicktime") {
    try {
      const parsed = parseMp4DurationMs(await file.arrayBuffer());
      if (parsed && parsed > 0) return parsed;
    } catch {
      /* fall through to the element */
    }
  }
  const meta = await loadVideoMeta(file);
  const ms = meta && meta.durationMs > 0 ? meta.durationMs : null;
  if (ms == null && typeof console !== "undefined") {
    // Breadcrumb (survives minification) so a still-failing read is diagnosable
    // from the browser console instead of another blind round-trip.
    console.warn(`[bl-social] could not read video duration for ${file.type} (${file.size}B)`);
  }
  return ms;
}

// Capture a poster frame + the video's pixel dimensions. Seeks to ~1s — a NORMAL
// in-range seek, unaffected by the Infinity-duration quirk — and draws to a canvas.
async function capturePoster(
  file: Blob,
  hintDurationMs: number,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  const work = new Promise<{ blob: Blob; width: number; height: number } | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const v = makeHiddenVideo(url);
    v.preload = "auto";
    let settled = false;
    const done = (r: { blob: Blob; width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      v.load();
      v.remove();
      resolve(r);
    };
    v.onloadeddata = () => {
      const at = Math.min(1, hintDurationMs / 2000 || 0);
      try {
        v.currentTime = at;
      } catch {
        done(null);
      }
    };
    v.onseeked = () => {
      const width = v.videoWidth;
      const height = v.videoHeight;
      const canvas = document.createElement("canvas");
      canvas.width = width || 1280;
      canvas.height = height || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) return done(null);
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => done(b ? { blob: b, width, height } : null), "image/webp", 0.8);
    };
    v.onerror = () => done(null);
  });
  return guardMeta(work, META_TIMEOUT_MS);
}

// Read a pre-upload candidate for validateMediaSelection: mime + bytes, plus the
// video duration so an over-length (or unreadable) clip is rejected BEFORE upload.
export async function readMediaCandidate(
  file: File,
): Promise<{ mime: string; bytes: number; durationMs?: number }> {
  if (mediaKind(file.type) === "video") {
    const durationMs = await readVideoDurationMs(file);
    return { mime: file.type, bytes: file.size, durationMs: durationMs ?? undefined };
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
  const durationMs = await readVideoDurationMs(file);
  if (!durationMs || durationMs <= 0) throw new Error("video-meta-failed"); // fail closed
  const poster = await capturePoster(file, durationMs);
  if (!poster) throw new Error("poster-failed"); // a video without a poster is rejected
  const path = mediaPath(uid, uuid, extForMime(file.type));
  const posterPath = mediaPath(uid, `${uuid}-poster`, "webp");
  onStage?.("uploading");
  await uploadBlob(supabase, posterPath, poster.blob, "image/webp");
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
