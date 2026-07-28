"use client";

import { useEffect, useState } from "react";
import { FileText, ImageOff } from "lucide-react";
import type { Attachment } from "@/lib/messaging";
import { formatBytes, isImageType, isVideoType, signedUrlFor } from "@/lib/attachments";
import { sanitizeFilename } from "@/lib/attachmentName";

// Renders one attachment, fetching its own short-TTL signed URL (RLS-gated to thread
// participants AND magic-byte-gated by the server route — a blocked file resolves to
// null → "unavailable", never delivered). Images render inline + lightbox; videos
// render with NATIVE controls (autoplay off, click-to-play — no poster extraction);
// documents render as a downloadable card. The displayed filename is re-sanitized
// here (D-052) because a malicious sender can write the jsonb directly.
export default function AttachmentView({
  attachment,
  onOpenImage,
  labels,
}: {
  attachment: Attachment;
  onOpenImage: (url: string, name: string) => void;
  labels: { download: string; unavailable: string };
}) {
  const name = sanitizeFilename(attachment.name);
  const isImage = isImageType(attachment.type);
  const isVideo = isVideoType(attachment.type);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Images + videos resolve their URL eagerly (to render); docs resolve on click.
    if (!isImage && !isVideo) return;
    let active = true;
    signedUrlFor(attachment.path).then((u) => {
      if (!active) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [attachment.path, isImage, isVideo]);

  if (isImage) {
    if (failed) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-xs text-ink-soft">
          <ImageOff size={15} /> {labels.unavailable}
        </div>
      );
    }
    const ratio = attachment.width && attachment.height ? attachment.width / attachment.height : undefined;
    return (
      <button
        type="button"
        onClick={() => url && onOpenImage(url, name)}
        className="block max-w-[240px] overflow-hidden rounded-lg border border-border bg-bg"
        style={ratio ? { aspectRatio: String(ratio) } : undefined}
        aria-label={name}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="grid h-40 w-60 place-items-center text-ink-soft">…</div>
        )}
      </button>
    );
  }

  if (isVideo) {
    if (failed) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-xs text-ink-soft">
          <ImageOff size={15} /> {labels.unavailable}
        </div>
      );
    }
    return url ? (
      // Native controls: autoplay OFF, click-to-play. preload="metadata" shows the
      // first frame without downloading the whole clip.
      <video src={url} controls preload="metadata" className="max-w-[240px] rounded-lg border border-border bg-black" aria-label={name} />
    ) : (
      <div className="grid h-40 w-60 place-items-center rounded-lg border border-border bg-bg text-ink-soft">…</div>
    );
  }

  async function openDoc() {
    const u = await signedUrlFor(attachment.path);
    if (u) window.open(u, "_blank", "noopener,noreferrer");
  }
  return (
    <button
      type="button"
      onClick={openDoc}
      className="flex items-center gap-2.5 rounded-lg border border-border bg-bg px-3 py-2 text-left hover:border-primary"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
        <FileText size={17} />
      </span>
      <span className="min-w-0">
        <span className="block max-w-[200px] truncate text-sm font-medium text-ink">{name}</span>
        <span className="block text-[11px] text-ink-soft">
          {formatBytes(attachment.size)} · {labels.download}
        </span>
      </span>
    </button>
  );
}
