import type { SupabaseClient } from "@supabase/supabase-js";
import type { Attachment } from "./messaging";
import { sanitizeFilename } from "./attachmentName";

// Client-side type/size checks are for fast UX only. The SECURITY boundary is the
// server-side magic-byte sniff on the read route (D-052) + storage RLS on the object
// path — never these values (extension/Content-Type are attacker-controlled).
export type AttachmentKind = "image" | "video" | "document";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
export const DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "text/csv",
  "text/plain",
] as const;

// Per-kind size caps (bucket file_size_limit is 50MB after D-053).
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const DOC_MAX_BYTES = 10 * 1024 * 1024;

export const MAX_IMAGE_DIM = 2000;
export const ATTACHMENT_BUCKET = "message-attachments";

// `accept` attributes for the three attachment-sheet sources. Extension hints are
// included for csv/txt because browsers disagree on their MIME (a .csv is variously
// text/csv, application/vnd.ms-excel or empty).
export const ACCEPT_MEDIA = [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");
export const ACCEPT_DOCUMENT = [...DOC_TYPES, ".csv", ".txt", ".docx", ".xlsx", ".pdf"].join(",");
export const ACCEPT_CAMERA = "image/*,video/*";

export function isImageType(type: string): boolean {
  return (IMAGE_TYPES as readonly string[]).includes(type);
}
export function isVideoType(type: string): boolean {
  return (VIDEO_TYPES as readonly string[]).includes(type);
}

function kindOfMime(type: string): AttachmentKind | null {
  if ((IMAGE_TYPES as readonly string[]).includes(type)) return "image";
  if ((VIDEO_TYPES as readonly string[]).includes(type)) return "video";
  if ((DOC_TYPES as readonly string[]).includes(type)) return "document";
  return null;
}

const EXT_KIND: Record<string, AttachmentKind> = {
  jpg: "image", jpeg: "image", png: "image", webp: "image", gif: "image",
  mp4: "video", webm: "video", mov: "video",
  pdf: "document", docx: "document", xlsx: "document", csv: "document", txt: "document",
};

/** Guess the kind from MIME, falling back to the extension (Android often reports an
 *  empty type). Null = unrecognized → the client rejects it up front. */
export function kindOfFile(file: { type: string; name: string }): AttachmentKind | null {
  const byMime = kindOfMime(file.type);
  if (byMime) return byMime;
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  return EXT_KIND[ext] ?? null;
}

export function sizeCapFor(kind: AttachmentKind): number {
  return kind === "video" ? VIDEO_MAX_BYTES : kind === "image" ? IMAGE_MAX_BYTES : DOC_MAX_BYTES;
}

export type FileCheck = { ok: true; kind: AttachmentKind } | { ok: false; reason: "type" | "size" };

export function validateFile(file: { type: string; size: number; name: string }): FileCheck {
  const kind = kindOfFile(file);
  if (!kind) return { ok: false, reason: "type" };
  if (file.size > sizeCapFor(kind)) return { ok: false, reason: "size" };
  return { ok: true, kind };
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", webm: "video/webm", mov: "video/mp4",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv", txt: "text/plain",
};

/** Canonical, allowlisted Content-Type for upload + the stored descriptor. Browsers
 *  disagree on csv/txt MIME and Android often reports an empty type, so a raw
 *  file.type would trip the bucket allowlist; derive it from the extension instead.
 *  This is NOT a security signal — the server magic-byte sniff (D-052) is. */
export function contentTypeFor(file: { type: string; name: string }): string {
  const all = [...IMAGE_TYPES, ...VIDEO_TYPES, ...DOC_TYPES] as readonly string[];
  if (all.includes(file.type)) return file.type;
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function extFor(type: string, name: string): string {
  const fromName = name.includes(".") ? name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  if (fromName) return fromName;
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/webm": "webm",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/csv": "csv", "text/plain": "txt",
  };
  return map[type] ?? "bin";
}

/**
 * Downscale a still image to <= MAX_IMAGE_DIM on its longest edge, re-encoding in the
 * same format. GIF is skipped (canvas can't re-encode it — would drop animation).
 * Returns the original blob if already small enough or if the browser can't decode it.
 */
export async function resizeImage(file: File): Promise<{ blob: Blob; width?: number; height?: number }> {
  const resizable = file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp";
  if (!resizable || typeof createImageBitmap !== "function") return { blob: file };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { blob: file };
  }
  const { width, height } = bitmap;
  const longest = Math.max(width, height);
  if (longest <= MAX_IMAGE_DIM) {
    bitmap.close();
    return { blob: file, width, height };
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
    return { blob: file, width, height };
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), file.type, 0.9));
  return { blob, width: w, height: h };
}

/**
 * (resize if still image) → upload under {threadId}/{uploaderId}/{uuid.ext} (the path
 * prefix storage RLS keys on) → return an Attachment descriptor. The stored `name` is
 * SANITIZED (D-052) so a bidi-spoofed filename never reaches the jsonb. Caller must
 * have validated size/kind and (for video) duration first. Throws on upload failure.
 */
export async function uploadAttachment(
  supabase: SupabaseClient,
  threadId: string,
  uploaderId: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<Attachment> {
  const contentType = contentTypeFor(file);
  const still = contentType.startsWith("image/") && contentType !== "image/gif";
  const { blob, width, height } = still ? await resizeImage(file) : { blob: file, width: undefined, height: undefined };

  const path = `${threadId}/${uploaderId}/${crypto.randomUUID()}.${extFor(contentType, file.name)}`;
  onProgress?.(0.1);
  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  onProgress?.(1);

  return { path, type: contentType, name: sanitizeFilename(file.name), size: blob.size, width, height };
}

export type ScanResult =
  | { ok: true; url: string; type: string }
  | { ok: false; reason: "blocked" | "network" };

/**
 * Ask the read-gate to verify an uploaded object by its MAGIC BYTES (D-052) and mint
 * a URL. Used for immediate sender feedback: a `.exe` renamed `.pdf` comes back
 * `blocked` here, and the caller deletes the object. The same gate protects the
 * recipient, so this is UX, not the boundary.
 */
export async function scanUploaded(path: string): Promise<ScanResult> {
  try {
    const res = await fetch(`/api/messages/attachment?path=${encodeURIComponent(path)}`);
    if (res.status === 403) return { ok: false, reason: "blocked" };
    if (!res.ok) return { ok: false, reason: "network" };
    const json = (await res.json()) as { url?: string; type?: string };
    if (!json.url) return { ok: false, reason: "network" };
    return { ok: true, url: json.url, type: json.type ?? "" };
  } catch {
    return { ok: false, reason: "network" };
  }
}

/** Fetch a short-TTL signed URL (RLS-gated + magic-byte-gated by the server route). */
export async function signedUrlFor(path: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/messages/attachment?path=${encodeURIComponent(path)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { url?: string };
    return json.url ?? null;
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
