"use client";

import { useState } from "react";

/**
 * Avatar — renders a real image when a url is present, otherwise a two-letter
 * monogram. If the image fails to load it falls back to the monogram, so a
 * broken avatar_url/logo_url never shows a broken-image icon.
 *
 * Used everywhere a person or business is represented (directory, profiles,
 * business pages, team lists, sidebar). Monogram styling matches the prior
 * inline treatment (pine-soft field, pine initials) so nothing regresses when
 * a url is absent.
 */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  name,
  url,
  size = 44,
  shape = "circle",
  className = "",
}: {
  name: string | null | undefined;
  url?: string | null;
  size?: number;
  shape?: "circle" | "rounded";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const label = name ?? "?";
  const radius = shape === "circle" ? "rounded-full" : "rounded-lg";
  const showImg = Boolean(url) && !failed;
  const fontPx = Math.max(11, Math.round(size * 0.36));

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden ${radius} bg-primary-soft font-bold text-primary ${className}`}
      style={{ width: size, height: size, fontSize: fontPx }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url as string}
          alt={name ?? ""}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        initials(label)
      )}
    </span>
  );
}
