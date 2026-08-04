"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Loader2, Trash2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import { AVATAR_ACCEPT, AVATAR_ALLOWED_MIME, AVATAR_SIZE, type AvatarKind } from "@/lib/avatar";

// Client-side center-crop to a square AVATAR_SIZE and re-encode to webp. Browser-only (canvas),
// so it lives here — NOT in the pure lib/avatar.ts. Returns null if the browser can't decode
// (caller falls back to the original file; the route sniffs + accepts jpeg/png/webp anyway).
async function toSquareWebp(file: File): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function") return null;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return null;
  }
  const min = Math.min(bmp.width, bmp.height);
  const sx = (bmp.width - min) / 2;
  const sy = (bmp.height - min) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close();
    return null;
  }
  ctx.drawImage(bmp, sx, sy, min, min, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bmp.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/webp", 0.9));
}

/**
 * Click the avatar (or the "Change photo" text) to pick an image → downscale to a 512x512 webp →
 * POST /api/avatar (which sniffs the bytes + enforces ownership + writes the column + removes the
 * old object). "Remove photo" clears the column AND deletes the object. Optimistic preview + a
 * real error state — never a silent failure. RLS is the real guard; for business logos the
 * caller must OWN the business (the wire-in also gates the UI to avoid an opaque 403).
 */
export default function AvatarUpload({
  kind,
  businessId,
  currentUrl,
  name,
  label,
  shape = "circle",
  size = 88,
  onChange,
}: {
  kind: AvatarKind;
  businessId?: string; // required when kind === "business"
  currentUrl: string | null;
  name: string | null;
  label?: string;
  shape?: "circle" | "rounded";
  size?: number;
  onChange?: (url: string | null) => void;
}) {
  const t = useTranslations("avatar");
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(currentUrl);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | null) {
    if (!file) return;
    setError(null);
    if (!(AVATAR_ALLOWED_MIME as readonly string[]).includes(file.type)) {
      setError(t("errType")); // fast UX guard; the server sniff is the real gate
      return;
    }
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setBusy(true);
    try {
      const blob = (await toSquareWebp(file)) ?? file;
      const form = new FormData();
      form.append("file", blob, "avatar.webp");
      form.append("kind", kind);
      if (kind === "business" && businessId) form.append("businessId", businessId);
      const res = await fetch("/api/avatar", { method: "POST", body: form });
      if (!res.ok) {
        setError(res.status === 415 ? t("errType") : res.status === 413 ? t("errSize") : t("errUpload"));
        return;
      }
      const json = (await res.json()) as { url?: string };
      if (!json.url) {
        setError(t("errUpload"));
        return;
      }
      setUrl(json.url);
      onChange?.(json.url);
    } catch {
      setError(t("errUpload"));
    } finally {
      setBusy(false);
      URL.revokeObjectURL(localPreview);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/avatar", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, businessId: kind === "business" ? businessId : undefined }),
      });
      if (!res.ok) {
        setError(t("errRemove"));
        return;
      }
      setUrl(null);
      onChange?.(null);
    } catch {
      setError(t("errRemove"));
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? url;

  return (
    <div>
      {label && <span className="eyebrow text-ink-soft">{label}</span>}
      <div className={`flex items-center gap-3 ${label ? "mt-1.5" : ""}`}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={url ? t("change") : t("add")}
          className="relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
        >
          <Avatar name={name} url={shown} size={size} shape={shape} />
          <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full border-2 border-surface bg-primary text-on-primary">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
          </span>
        </button>
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="block text-sm font-medium text-primary hover:text-primary-pressed disabled:opacity-60"
          >
            {url ? t("change") : t("add")}
          </button>
          {url && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-accent disabled:opacity-60"
            >
              <Trash2 size={12} aria-hidden /> {t("remove")}
            </button>
          )}
          {error ? (
            <p className="mt-0.5 text-xs text-accent" role="alert">
              {error}
            </p>
          ) : (
            <p className="mt-0.5 text-[11px] text-ink-soft">{t("hint")}</p>
          )}
        </div>
        <input ref={inputRef} type="file" accept={AVATAR_ACCEPT} hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
      </div>
    </div>
  );
}
