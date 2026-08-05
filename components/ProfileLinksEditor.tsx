"use client";

import { useTranslations } from "next-intl";
import { PROFILE_LINK_FIELDS } from "@/lib/socialLinks";
import { LINK_ICON } from "@/components/ProfileLinks";

// Placeholder host hints per field — guide the owner toward a full URL (bare handles are not
// accepted by the normalizer). website first, since it's the most common.
const PLACEHOLDER: Record<(typeof PROFILE_LINK_FIELDS)[number], string> = {
  website: "https://your-site.com",
  linkedin: "https://linkedin.com/in/…",
  instagram: "https://instagram.com/…",
  facebook: "https://facebook.com/…",
  x: "https://x.com/…",
  youtube: "https://youtube.com/@…",
  tiktok: "https://tiktok.com/@…",
};

// website first, then the social platforms.
const FIELD_ORDER = ["website", ...PROFILE_LINK_FIELDS.filter((f) => f !== "website")] as const;

/**
 * Controlled input group for a member's profile links. `value` is the RAW {field: string} bag as
 * typed; the parent normalizes with normalizeProfileLinks(value) on save. Shared by the profile
 * editor and the welcome/onboarding flow so the two never drift.
 */
export default function ProfileLinksEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  const t = useTranslations("links");

  return (
    <div>
      <span className="eyebrow text-ink-soft">{t("heading")}</span>
      <p className="mt-0.5 text-xs text-ink-soft">{t("hint")}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {FIELD_ORDER.map((f) => {
          const Icon = LINK_ICON[f];
          return (
            <label key={f} className="flex items-center gap-2 rounded-md border border-border-input px-2.5 py-1.5 focus-within:border-primary">
              <Icon size={15} className="shrink-0 text-ink-soft" aria-hidden />
              <input
                type="url"
                inputMode="url"
                value={value[f] ?? ""}
                onChange={(e) => onChange({ ...value, [f]: e.target.value })}
                placeholder={PLACEHOLDER[f]}
                aria-label={t(f)}
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
