"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/lib/store";
import { detectBodyLang } from "@/lib/detectLang";
import {
  validateMediaSelection,
  mediaErrorKey,
  mediaKind,
  MEDIA_ACCEPT,
  VIDEO_MAX_BYTES,
  type PostMedia,
  type MediaCandidate,
} from "@/lib/feed/media";
import { uploadPostMediaFile, deletePostMediaObjects } from "@/lib/feed/mediaUpload";
import { checkVideoForComposer } from "@/lib/media/readVideoDuration";

export default function Composer({
  isVerified,
  onPosted,
}: {
  isVerified: boolean;
  onPosted: () => void;
}) {
  const t = useTranslations("composer");
  const tSocial = useTranslations("social");
  const supabase = createClient();
  const { view } = useApp();
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [media, setMedia] = useState<PostMedia[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Synchronous re-entrancy guard: the file input's onChange can fire twice
  // (double-fire / re-render), and two concurrent onPick runs race — one uploads
  // (storage 200) while the other's catch reports failure and clobbers it. A ref
  // (not state) is checked/set synchronously so the second call bails immediately.
  const picking = useRef(false);

  const candidatesOf = (list: PostMedia[]): MediaCandidate[] =>
    list.map((m) => ({ mime: m.mime, bytes: m.bytes }));

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (picking.current) return; // already handling a selection
    picking.current = true;
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      picking.current = false;
      return;
    }

    setBusy(true);
    try {
      const newFiles = Array.from(files);
      // 1. Structural validation of the whole selection (≤4 images XOR 1 video).
      const newCandidates = newFiles.map((f) => ({ mime: f.type, bytes: f.size }));
      const combined = [...candidatesOf(media), ...newCandidates];
      const check = validateMediaSelection(combined);
      if (!check.ok) {
        setError(tSocial(`mediaError.${mediaErrorKey(check.reason)}`));
        return;
      }
      // 2. Per-video gate: size first (free), then duration from the container
      // bytes (D-042). unreadable and too_long are DISTINCT messages. Keep the
      // measured duration so the upload does not re-read it (avoids a redundant,
      // potentially slow second read).
      const durations = new Map<File, number>();
      for (const file of newFiles) {
        if (mediaKind(file.type) !== "video") continue;
        if (file.size > VIDEO_MAX_BYTES) {
          setError(t("video.tooLarge"));
          return;
        }
        const vc = await checkVideoForComposer(file);
        if (vc.status === "too_long") {
          setError(t("video.tooLong", { seconds: Math.round(vc.seconds) }));
          return;
        }
        if (vc.status === "unreadable") {
          setError(t("video.unreadable"));
          return;
        }
        durations.set(file, vc.seconds);
      }
      // 3. Upload the new files one at a time, keeping a local preview per file.
      const added: PostMedia[] = [];
      const newPreviews: Record<string, string> = {};
      for (const file of newFiles) {
        if (!mediaKind(file.type)) continue;
        const descriptor = await uploadPostMediaFile(supabase, user.id, file, undefined, durations.get(file));
        added.push(descriptor);
        try {
          newPreviews[descriptor.path] = URL.createObjectURL(file);
        } catch {
          /* preview is best-effort */
        }
      }
      setMedia((prev) => [...prev, ...added]);
      setPreviews((prev) => ({ ...prev, ...newPreviews }));
    } catch (err) {
      // Surface the ACTUAL failure (poster-failed / video-meta-failed / a storage
      // error) to the console — the UI string is generic, which is why the real
      // cause was invisible in QA.
      console.error("[composer] media pick failed:", err);
      setError(tSocial("mediaUploadFailed"));
    } finally {
      setBusy(false);
      picking.current = false;
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeMedia(item: PostMedia) {
    setMedia((prev) => prev.filter((m) => m.path !== item.path));
    setPreviews((prev) => {
      const url = prev[item.path];
      if (url) URL.revokeObjectURL(url);
      const next = { ...prev };
      delete next[item.path];
      return next;
    });
    await deletePostMediaObjects(supabase, [item]);
  }

  function setAlt(path: string, alt: string) {
    setMedia((prev) => prev.map((m) => (m.type === "image" && m.path === path ? { ...m, alt } : m)));
  }

  async function publish() {
    if (!body.trim() && media.length === 0) return;
    setPosting(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setPosting(false);
      return;
    }
    const trimmed = body.trim();
    const { error: insErr } = await supabase.from("posts").insert({
      author_id: user.id,
      posted_as: "user",
      body: trimmed || "",
      body_lang: detectBodyLang(trimmed),
      view,
      media,
    });
    if (insErr) {
      // Post failed → clean up the uploaded objects so we leave no orphans (§4.3).
      await deletePostMediaObjects(supabase, media);
      setError(tSocial("postFailed"));
      setPosting(false);
      return;
    }
    setBody("");
    setMedia([]);
    Object.values(previews).forEach((u) => URL.revokeObjectURL(u));
    setPreviews({});
    setPosting(false);
    onPosted();
  }

  if (!isVerified) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-bg p-3 text-sm text-ink-soft">
        {t("verifyToPost")}{" "}
        <a href="/profile/verify" className="font-medium text-primary hover:text-primary-pressed">
          {t("verifyNow")}
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder={t("placeholder")}
        className="w-full resize-none border-none p-0 text-sm outline-none placeholder:text-ink-soft"
      />

      {media.length > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {media.map((m) => (
            <div key={m.path} className="relative">
              <div className="relative aspect-square overflow-hidden rounded-md bg-surface-2">
                <StagedThumb item={m} preview={previews[m.path]} />
                <button
                  type="button"
                  onClick={() => removeMedia(m)}
                  aria-label={tSocial("removeMedia")}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X size={13} />
                </button>
              </div>
              {m.type === "image" && (
                <input
                  value={m.alt ?? ""}
                  onChange={(e) => setAlt(m.path, e.target.value)}
                  placeholder={tSocial("altPlaceholder")}
                  className="mt-1 w-full rounded border border-border-input px-1.5 py-1 text-[11px] outline-none focus:border-primary"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-accent" role="alert">{error}</p>}

      <div className="mt-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy}
          aria-label={tSocial("addMedia")}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-ink-soft hover:bg-surface-2 disabled:opacity-50"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
          {tSocial("addMedia")}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={MEDIA_ACCEPT.join(",")}
          multiple
          hidden
          onChange={(e) => onPick(e.target.files)}
        />
        <button
          onClick={publish}
          disabled={(!body.trim() && media.length === 0) || posting || busy}
          className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-40"
        >
          {posting ? t("posting") : t("post")}
        </button>
      </div>
    </div>
  );
}

// A local preview of a staged file from the original File's blob URL (kept in the
// composer). Falls back to a neutral type label if the preview is unavailable.
function StagedThumb({ item, preview }: { item: PostMedia; preview?: string }) {
  const tSocial = useTranslations("social");
  if (preview) {
    return item.type === "video" ? (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video src={preview} muted className="h-full w-full object-cover" />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={preview} alt="" className="h-full w-full object-cover" />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center text-[11px] font-medium text-ink-soft">
      {item.type === "video" ? tSocial("videoLabel") : tSocial("imageLabel")}
    </div>
  );
}
