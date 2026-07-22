import { ShieldCheck } from "lucide-react";

/**
 * TrustBadge — the single, reusable verification mark.
 *
 * Design-foundations trust vocabulary: one shield, one hue (teal --trust,
 * deliberately not green ≠ success and not pine ≠ clickable), fill progression.
 * Absence is neutral: an unverified subject renders NO badge (never a scarlet
 * letter), so this returns null when `verified` is false — callers should not
 * wrap it in surrounding chrome.
 *
 * `tier="bridge"` adds the gold prestige ring (design-foundations: filled +
 * gold ring). It is forward-compatible: the DB does not yet model a Bridge tier,
 * so no caller passes it today, but the vocabulary is in place for when it does.
 *
 * No hooks — safe to render from both server and client components. Label is
 * passed in by the caller so it stays localized in context (Verified / Verified
 * business / etc.) without introducing new i18n keys here.
 */
export default function TrustBadge({
  verified,
  label,
  size = "sm",
  tier,
}: {
  verified: boolean;
  label: string;
  size?: "sm" | "md";
  tier?: "bridge";
}) {
  if (!verified) return null;

  const pad = size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]";
  const icon = size === "md" ? 13 : 11;

  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1 rounded font-semibold bg-trust-soft text-trust-ink ${pad} ${
        tier === "bridge" ? "ring-1 ring-gold" : ""
      }`}
    >
      <ShieldCheck size={icon} strokeWidth={2.4} className="text-trust" aria-hidden />
      {label}
    </span>
  );
}
