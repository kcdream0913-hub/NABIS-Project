// BL-SOCIAL-02 §4.3/§4.4 — post media: pure validation + poster-generation
// pipeline. The MIME lists, size caps, and the "≤4 images XOR 1 video" rule mirror
// validate_post_media() in the migration exactly (client checks are UX; the trigger
// is the backstop). Anything DOM-touching (canvas, <video>) is injected so the
// decision logic stays unit-testable without a codec.

export const IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export const VIDEO_MIME = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;
export const MEDIA_ACCEPT: string[] = [...IMAGE_MIME, ...VIDEO_MIME];

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB  (trigger: 10485760)
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB  (trigger: 52428800)
export const VIDEO_MAX_MS = 90_000; // 90 s      (trigger: > 90000 rejected)
export const MAX_IMAGES = 4;

// Element shapes persisted in posts.media (validated by the DB trigger).
export type ImageMedia = {
  type: "image";
  path: string;
  mime: string;
  bytes: number;
  w: number;
  h: number;
  alt?: string;
};
export type VideoMedia = {
  type: "video";
  path: string;
  mime: string;
  bytes: number;
  duration_ms: number;
  poster_path: string;
  w: number;
  h: number;
};
export type PostMedia = ImageMedia | VideoMedia;

export type MediaKind = "image" | "video";

export function mediaKind(mime: string): MediaKind | null {
  if ((IMAGE_MIME as readonly string[]).includes(mime)) return "image";
  if ((VIDEO_MIME as readonly string[]).includes(mime)) return "video";
  return null;
}

export type MediaCandidate = {
  mime: string;
  bytes: number;
  durationMs?: number; // required for videos
};

export type MediaError =
  | "empty"
  | "type"
  | "too-many-images"
  | "one-video-only"
  | "no-mixing"
  | "image-too-large"
  | "video-too-large"
  | "video-unreadable"
  | "video-too-long";

export type MediaValidation = { ok: true } | { ok: false; reason: MediaError };

// §4.3 — enforce the whole selection, not one file at a time, so the picker can
// reject "up to 4 images OR exactly 1 video" up front (X's rule) with a clear
// message. Order of checks is deliberate: structural rules before size rules so a
// "2 videos" selection reports one-video-only, not video-too-large.
export function validateMediaSelection(
  items: MediaCandidate[],
): MediaValidation {
  if (items.length === 0) return { ok: false, reason: "empty" };

  const kinds = items.map((i) => mediaKind(i.mime));
  if (kinds.some((k) => k === null)) return { ok: false, reason: "type" };

  const images = items.filter((_, i) => kinds[i] === "image");
  const videos = items.filter((_, i) => kinds[i] === "video");

  if (videos.length > 1) return { ok: false, reason: "one-video-only" };
  if (videos.length >= 1 && images.length >= 1)
    return { ok: false, reason: "no-mixing" };
  if (images.length > MAX_IMAGES) return { ok: false, reason: "too-many-images" };

  for (const img of images) {
    if (img.bytes > IMAGE_MAX_BYTES) return { ok: false, reason: "image-too-large" };
  }
  for (const vid of videos) {
    if (vid.bytes > VIDEO_MAX_BYTES) return { ok: false, reason: "video-too-large" };
    // A missing / zero / non-finite (Infinity/NaN) duration means we could not
    // read the clip's length — report THAT, never a false "too long".
    if (vid.durationMs == null || !Number.isFinite(vid.durationMs) || vid.durationMs <= 0)
      return { ok: false, reason: "video-unreadable" };
    if (vid.durationMs > VIDEO_MAX_MS) return { ok: false, reason: "video-too-long" };
  }
  return { ok: true };
}

// Storage path: the FIRST segment MUST be the uploader's id or the storage policy
// (post_media_insert_own) rejects it. Never allow ".." (the trigger also blocks it).
export function mediaPath(uid: string, uuid: string, ext: string): string {
  return `${uid}/${uuid}.${ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin"}`;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function extForMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? "bin";
}

// ── poster generation (§4.3) — injectable so it is testable without a codec ────
export type VideoMeta = { durationMs: number; width: number; height: number };

export type PosterDeps = {
  // Resolve video metadata, or null if it never loads / errors (fail closed).
  loadMeta: (file: Blob) => Promise<VideoMeta | null>;
  // Draw ~1s frame to a canvas and return a webp blob (or null on failure).
  capture: (file: Blob, meta: VideoMeta) => Promise<Blob | null>;
};

// Returns the poster blob for a valid video, or null (→ NO upload) when metadata
// never loads. A post with a video requires a poster_path (the trigger enforces
// it), so a null here must block the post, not silently ship a posterless video.
export async function generatePoster(
  file: Blob,
  deps: PosterDeps,
): Promise<Blob | null> {
  const meta = await deps.loadMeta(file);
  if (!meta) return null; // fail closed — do not capture, do not upload
  return deps.capture(file, meta);
}

// Resolve a promise, or null if it does not settle within `timeoutMs`. This is
// what makes metadata loading "fail closed": a <video> that never fires
// loadedmetadata yields null instead of hanging the composer.
export function guardMeta<T>(
  p: Promise<T>,
  timeoutMs: number,
  scheduler: (fn: () => void, ms: number) => unknown = setTimeout,
): Promise<T | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: T | null) => {
      if (done) return;
      done = true;
      resolve(v);
    };
    scheduler(() => finish(null), timeoutMs);
    p.then((v) => finish(v)).catch(() => finish(null));
  });
}

const HUMAN: Record<MediaError, string> = {
  empty: "empty",
  type: "type",
  "too-many-images": "tooManyImages",
  "one-video-only": "oneVideoOnly",
  "no-mixing": "noMixing",
  "image-too-large": "imageTooLarge",
  "video-too-large": "videoTooLarge",
  "video-unreadable": "videoUnreadable",
  "video-too-long": "videoTooLong",
};

// Map a MediaError to its i18n key suffix under the `social.mediaError` namespace.
export function mediaErrorKey(reason: MediaError): string {
  return HUMAN[reason];
}
