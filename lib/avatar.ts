// lib/avatar.ts — pure, isomorphic helpers for the avatar/logo pipeline (BL-AVATAR-01).
// The browser-only 512x512-webp resize lives in components/AvatarUpload.tsx; everything here is
// pure so it unit-tests without a browser or DB. The SECURITY boundary is the server-side
// magic-byte sniff in /api/avatar (D-052) + the avatars storage RLS — never these values.

import type { SniffResult } from "./attachmentSniff";

export const AVATAR_BUCKET = "avatars";
export const AVATAR_SIZE = 512; // square edge; client downscale target
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // matches the bucket file_size_limit

// Accept exactly these three by SNIFFED type. No GIF (animated avatars in a professional
// directory are an unrequested moderation surface).
export const AVATAR_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export type AvatarMime = (typeof AVATAR_ALLOWED_MIME)[number];
export const AVATAR_ACCEPT = AVATAR_ALLOWED_MIME.join(",");

export type AvatarKind = "user" | "business";

const EXT_BY_MIME: Record<AvatarMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** File extension for a sniffed avatar MIME (unknown → "bin", never trusted for the decision). */
export function avatarExtFor(mime: string): string {
  return EXT_BY_MIME[mime as AvatarMime] ?? "bin";
}

/** True iff a MIME is an allowed avatar image. Used against the SNIFFED type, never the claim. */
export function isAllowedAvatarMime(mime: string): mime is AvatarMime {
  return (AVATAR_ALLOWED_MIME as readonly string[]).includes(mime);
}

/** The upload decision from a magic-byte sniff: accept only when sniffed AND allowlisted. */
export function avatarSniffAccepted(sniff: SniffResult): boolean {
  return sniff.ok && isAllowedAvatarMime(sniff.mime);
}

/** Object key: the path prefix carries the owner so storage RLS can check it. */
export function avatarObjectPath(kind: AvatarKind, ownerId: string, uuid: string, mime: string): string {
  return `${kind}/${ownerId}/${uuid}.${avatarExtFor(mime)}`;
}

/**
 * The object PATH (relative to the bucket) for a public avatar URL WE minted, or null if the URL
 * is not one of ours (e.g. an OAuth googleusercontent avatar) — so delete-on-replace only ever
 * removes objects in OUR bucket, never a foreign URL.
 */
export function avatarPathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = url.slice(i + marker.length).split("?")[0];
  return path.length > 0 ? path : null;
}
