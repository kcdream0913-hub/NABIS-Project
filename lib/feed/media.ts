// BL-SOCIAL-02 §4.3/§4.4 — post media: pure STRUCTURAL validation + storage-path
// helpers. Video DURATION now lives in lib/media/readVideoDuration (D-042 — read
// from the container bytes, not HTMLVideoElement). This file only enforces the
// "≤4 images XOR 1 video" rule, the image size cap, and MIME allow-listing — all
// mirroring validate_post_media() (the DB trigger is the real backstop).

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
};

// Structural + image-size errors only. Video SIZE and DURATION are checked in the
// composer's per-video gate (size → composer.video.tooLarge; duration →
// checkVideoForComposer → composer.video.tooLong / unreadable), so they are not
// modelled here.
export type MediaError =
  | "empty"
  | "type"
  | "too-many-images"
  | "one-video-only"
  | "no-mixing"
  | "image-too-large";

export type MediaValidation = { ok: true } | { ok: false; reason: MediaError };

// §4.3 — enforce the whole selection, not one file at a time, so the picker can
// reject "up to 4 images OR exactly 1 video" up front (X's rule). Order is
// deliberate: structural rules before size rules so a "2 videos" selection reports
// one-video-only, not a size error.
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

const HUMAN: Record<MediaError, string> = {
  empty: "empty",
  type: "type",
  "too-many-images": "tooManyImages",
  "one-video-only": "oneVideoOnly",
  "no-mixing": "noMixing",
  "image-too-large": "imageTooLarge",
};

// Map a MediaError to its i18n key suffix under the `social.mediaError` namespace.
export function mediaErrorKey(reason: MediaError): string {
  return HUMAN[reason];
}
