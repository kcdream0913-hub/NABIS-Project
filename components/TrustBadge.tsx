import { ShieldCheck, Star } from "lucide-react";
import type { TrustTier } from "@/lib/trust";

/**
 * TrustBadge — the single, reusable verification mark.
 *
 * Rebranded vocabulary (foundation v1): Verified is a BLUE shield-check on a
 * soft-blue chip; Bridge is a SOLID GOLD star on a soft-gold chip. Absence is
 * neutral — an unverified subject renders NO badge (never a scarlet letter),
 * so this returns null for tier "none"; callers must not wrap it in chrome.
 *
 * Tiers map 1:1 to what the DB actually models (see lib/trust.ts):
 *   "verified" — at least one policy track verified: blue shield
 *   "bridge"   — BOTH the US and Nepal tracks verified: solid gold star
 * The tier is never colour-only: the caller passes a distinct label for Bridge,
 * so the distinction reaches screen readers and colour-blind users too.
 *
 * The prop stays `tier: TrustTier` (none|verified|bridge) rather than the
 * package's status/tier pair — the union already encodes all three states, so
 * every existing callsite and the trustTier mapping test are untouched.
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

  const isBridge = tier === "bridge";
  const pad = size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]";
  const icon = size === "md" ? 13 : 11;

  return (
    <span
      data-tier={tier}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1 rounded-md font-semibold ${pad} ${
        isBridge ? "bg-bridge-soft text-on-bridge" : "bg-primary-soft text-chip-ink"
      }`}
    >
      {isBridge ? (
        <Star size={icon} strokeWidth={0} fill="currentColor" className="text-bridge" aria-hidden />
      ) : (
        <ShieldCheck size={icon} strokeWidth={2.2} className="text-primary" aria-hidden />
      )}
      {label}
    </span>
  );
}
