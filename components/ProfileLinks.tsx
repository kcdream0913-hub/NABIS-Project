"use client";

import { useTranslations } from "next-intl";
import { Facebook, Instagram, Linkedin, Youtube, Twitter, Globe, Link as LinkIcon, type LucideIcon } from "lucide-react";
import { visibleProfileLinkFields, type ProfileLinkField } from "@/lib/socialLinks";

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
 * column scope, no server validation), so a member can store arbitrary jsonb on their OWN row —
 * incl. a `javascript:`/`data:` URL that would execute if rendered as an href. The write path
 * normalises to https via normalizeProfileLinks, but that is UX only; THIS filter (accept only
 * strings that start with "https://") is the actual guard. Do not relax it.
 *
 * Renders nothing when there are no valid links — never a labelled blank.
 */
export default function ProfileLinks({ links }: { links: Record<string, unknown> | null | undefined }) {
  const t = useTranslations("links");
  const entries = visibleProfileLinkFields(links);
  if (entries.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {entries.map((f) => {
        const Icon = LINK_ICON[f];
        const href = links![f] as string;
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
