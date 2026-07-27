import type { SupabaseClient } from "@supabase/supabase-js";
import type { Attachment } from "./messaging";

// Allowlist + size are ALSO enforced server-side by the bucket
// (allowed_mime_types + file_size_limit) and by storage RLS on the object path —
// these client checks are for fast UX feedback, not the security boundary.
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
] as const;
export const ACCEPT: string[] = [...IMAGE_TYPES, ...DOC_TYPES];
export const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_IMAGE_DIM = 2000;
export const ATTACHMENT_BUCKET = "message-attachments";

export function isImageType(type: string): boolean {
  return (IMAGE_TYPES as readonly string[]).includes(type);
}

export type FileCheck = { ok: true } | { ok: false; reason: "type" | "size" };

export function validateFile(file: { type: string; size: number }): FileCheck {
  if (!ACCEPT.includes(file.type)) return { ok: false, reason: "type" };
  if (file.size > MAX_BYTES) return { ok: false, reason: "size" };
  return { ok: true };
}

function extFor(type: string, name: string): string {
  const fromName = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (fromName) return fromName;
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  return map[type] ?? "bin";
}

/**
 * Downscale an image to <= MAX_IMAGE_DIM on its longest edge, re-encoding in the
 * same format. Returns the original blob if it is already small enough or if the
 * browser can't decode it. Client-only (uses canvas / createImageBitmap).
 */
export async function resizeImage(file: File): Promise<{ blob: Blob; width?: number; height?: number }> {
  if (!isImageType(file.type) || typeof createImageBitmap !== "function") return { blob: file };
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
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), file.type, 0.9),
  );
  return { blob, width: w, height: h };
}

/**
 * Validate → (resize if image) → upload under {threadId}/{uploaderId}/{uuid.ext}
 * (the path prefix storage RLS keys on) → return an Attachment descriptor to embed
 * in messages.attachments. Throws on validation/upload failure.
 */
export async function uploadAttachment(
  supabase: SupabaseClient,
  threadId: string,
  uploaderId: string,
  file: File,
): Promise<Attachment> {
  const check = validateFile(file);
  if (!check.ok) throw new Error(check.reason === "type" ? "unsupported-type" : "too-large");

  const { blob, width, height } = isImageType(file.type)
    ? await resizeImage(file)
    : { blob: file, width: undefined, height: undefined };

  const path = `${threadId}/${uploaderId}/${crypto.randomUUID()}.${extFor(file.type, file.name)}`;
  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, blob, { contentType: file.type, upsert: false });
  if (error) throw error;

  return { path, type: file.type, name: file.name, size: blob.size, width, height };
}

/** Fetch a short-TTL signed URL from the server route (RLS-gated to participants). */
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
