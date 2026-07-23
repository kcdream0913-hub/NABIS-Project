import { ShieldCheck } from "lucide-react";
import type { TrustTier } from "@/lib/trust";

/**
 * TrustBadge — the single, reusable verification mark.
 *
 * Design-foundations trust vocabulary: one shield, one hue (teal --trust,
 * deliberately not green ≠ success and not pine ≠ clickable), fill progression.
 * Absence is neutral: an unverified subject renders NO badge (never a scarlet
 * letter), so this returns null for tier "none" — callers should not wrap it in
 * surrounding chrome.
 *
 * Tiers map 1:1 to what the DB actually models (see lib/trust.ts):
 *   "verified" — at least one policy track verified: teal shield
 *   "bridge"   — BOTH the US and Nepal tracks verified: teal shield + gold ring
 * The gold ring is never the only signal — the caller passes a distinct label
 * for Bridge, so the tier is conveyed textually as well as by colour. That
 * keeps the distinction available to screen readers and to anyone who cannot
 * separate the two rings.
 *
 * No hooks — safe to render from both server and client components. Label is
 * passed in by the caller so it stays localized in context (Verified / Verified
 * business / Bridge verified) without introducing i18n into this component.
 */
export default function TrustBadge({
  tier,
  label,
  size = "sm",
}: {
  tier: TrustTier;
  label: string;
  size?: "sm" | "md";
}) {
  if (tier === "none") return null;

  const pad = size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]";
  const icon = size === "md" ? 13 : 11;

  return (
    <span
      data-tier={tier}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded font-semibold bg-trust-soft text-trust-ink ${pad} ${
        tier === "bridge" ? "ring-1 ring-gold" : ""
      }`}
    >
      <ShieldCheck size={icon} strokeWidth={2.4} className="text-trust" aria-hidden />
      {label}
    </span>
  );
}
