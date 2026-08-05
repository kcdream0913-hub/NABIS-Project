"use client";

import { useTranslations } from "next-intl";
import { Facebook, Instagram, Linkedin, Youtube, Twitter, Globe, Link as LinkIcon, type LucideIcon } from "lucide-react";
import { normalizeProfileLinks, PROFILE_LINK_FIELDS, type ProfileLinkField } from "@/lib/socialLinks";

// One icon per link field. lucide 0.474 has no TikTok brand mark, so it falls back to a generic
// link glyph (the visible label carries the platform name). x → the Twitter/X mark.
export const LINK_ICON: Record<ProfileLinkField, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  tiktok: LinkIcon,
  youtube: Youtube,
  x: Twitter,
  website: Globe,
};

/**
 * Renders a member's profile.links ({field: url}) as icon chips. Serves the same {field: url}
 * shape as businesses.social_links.
 *
 * SECURITY (load-bearing): profiles.links is directly client-writable (profiles_update_own, no
 * column scope, no server validation), so a member can store arbitrary jsonb on their OWN row,
 * bypassing the editor — a `javascript:` URL (XSS) or a platform link on the wrong host (e.g.
 * linkedin → evil.example, a brand-spoof/phishing chip). So we re-run the FULL validator here
 * (normalizeProfileLinks): only allowlisted-host platform links + any-host https website survive,
 * and we render the CLEANED value, never the raw stored one. Do not shortcut this to a scheme check.
 *
 * Renders nothing when there are no valid links — never a labelled blank.
 */
export default function ProfileLinks({ links }: { links: Record<string, unknown> | null | undefined }) {
  const t = useTranslations("links");
  const clean = normalizeProfileLinks(links ?? {});
  const entries = PROFILE_LINK_FIELDS.filter((f) => clean[f]);
  if (entries.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {entries.map((f) => {
        const Icon = LINK_ICON[f];
        const href = clean[f]!;
        return (
          <a
            key={f}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            title={t(f)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
          >
            <Icon size={14} aria-hidden />
            <span>{t(f)}</span>
          </a>
        );
      })}
    </div>
  );
}
