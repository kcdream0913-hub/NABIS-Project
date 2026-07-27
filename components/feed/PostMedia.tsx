"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Play, Volume2, VolumeX, X } from "lucide-react";
import type { PostMedia as PostMediaItem, ImageMedia, VideoMedia } from "@/lib/feed/media";

// BL-SOCIAL-02 §4.4 — media rendering. Signed URLs are resolved upstream (feed
// loader) and passed via `urls`. Never autoplay (R7): video shows a poster + play
// button, preload="metadata", playsInline, muted-by-default with an unmute control.
export default function PostMedia({
  media,
  urls,
}: {
  media: PostMediaItem[];
  urls: Record<string, string>;
}) {
  const t = useTranslations("social");
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);
  if (!media || media.length === 0) return null;

  const resolve = (p: string) => urls[p];

  // A single video renders on its own; images render in a 1–4 grid.
  const first = media[0];
  if (media.length === 1 && first.type === "video") {
    return <VideoTile item={first} urls={urls} />;
  }

  const images = media.filter((m): m is ImageMedia => m.type === "image");
  const n = images.length;
  // Layout classes per count (§4.4).
  const gridClass =
    n === 1 ? "grid-cols-1" : n === 3 ? "grid-cols-2 grid-rows-2" : "grid-cols-2";

  return (
    <>
      <div
        className={`mt-3 grid gap-0.5 overflow-hidden rounded-lg ${gridClass}`}
        role="group"
        aria-label={t("mediaGroup", { count: n })}
      >
        {images.map((img, i) => {
          const url = resolve(img.path);
          const large = n === 3 && i === 0; // one large left + two stacked right
          const single = n === 1;
          return (
            <button
              key={img.path}
              type="button"
              onClick={() => url && setLightbox({ url, alt: img.alt || t("imageAlt") })}
              className={`group relative block bg-surface-2 ${large ? "row-span-2" : ""}`}
              style={single && img.w && img.h ? { aspectRatio: `${img.w}/${img.h}`, maxHeight: 480 } : undefined}
              aria-label={img.alt || t("openImage")}
            >
              {url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={img.alt || ""}
                  width={img.w || undefined}
                  height={img.h || undefined}
                  loading="lazy"
                  className={`h-full w-full object-cover ${single ? "max-h-[480px]" : "aspect-square"}`}
                />
              ) : (
                <div className={`w-full ${single ? "h-64" : "aspect-square"}`} aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      {lightbox && <Lightbox url={lightbox.url} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </>
  );
}

function VideoTile({ item, urls }: { item: VideoMedia; urls: Record<string, string> }) {
  const t = useTranslations("social");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const url = urls[item.path];
  const poster = urls[item.poster_path];

  function start() {
    setPlaying(true);
    // play() after the element mounts; defer a tick
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (v) {
        v.muted = muted;
        void v.play().catch(() => {});
      }
    });
  }

  const ratio = item.w && item.h ? `${item.w}/${item.h}` : "16/9";

  return (
    <div className="mt-3 overflow-hidden rounded-lg bg-black" style={{ aspectRatio: ratio, maxHeight: 480 }}>
      {!playing ? (
        <button
          type="button"
          onClick={start}
          className="relative flex h-full w-full items-center justify-center"
          aria-label={t("playVideo")}
        >
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="absolute inset-0 bg-surface-2" aria-hidden />
          )}
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/30">
            <Play size={26} fill="currentColor" />
          </span>
        </button>
      ) : (
        <div className="relative h-full w-full">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            src={url}
            poster={poster}
            controls
            playsInline
            preload="metadata"
            muted={muted}
            className="h-full w-full object-contain"
          />
          <button
            type="button"
            onClick={() => {
              const v = videoRef.current;
              const next = !muted;
              setMuted(next);
              if (v) v.muted = next;
            }}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white"
            aria-label={muted ? t("unmute") : t("mute")}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}

// Tap-to-expand image lightbox: Esc / backdrop closes, focus trapped + restored.
function Lightbox({ url, alt, onClose }: { url: string; alt: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        // single focusable → keep focus on the close button (simple trap)
        e.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
        aria-label={alt ? `${alt} — close` : "Close"}
      >
        <X size={22} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
      />
    </div>
  );
}
