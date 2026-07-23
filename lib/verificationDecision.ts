import type { PolicyTrack } from "./kyc";

/**
 * Admin verification decisions — LIGHT model.
 *
 * Community-scale review: a reviewer records WHICH light signal they actually
 * saw (self-attestation, a reference, a public profile), optionally why, and
 * whether the subject falls in a higher-risk category that still wants a manual
 * credential lookup later (e.g. a Bar number). There is deliberately no
 * document-upload / KYC provider step here.
 *
 * These helpers are pure so the decision payload can be unit-tested without a
 * database: the admin UI only assembles them and hands them to Supabase.
 */
export type LightSignal = "self_attestation" | "reference" | "public_profile" | "other";

export const LIGHT_SIGNALS: LightSignal[] = [
  "self_attestation",
  "reference",
  "public_profile",
  "other",
];

/**
 * Normalize a free-text country onto the two corridor tracks. Returns null when
 * it cannot be inferred — verification_records.policy_track is NOT NULL, so the
 * caller must make the reviewer choose rather than silently guessing a track and
 * mislabelling which regulator's rules were applied.
 * Mirrors the directory's normCountry so both surfaces bucket countries alike.
 */
export function trackForCountry(country: string | null | undefined): PolicyTrack | null {
  const l = (country ?? "").toLowerCase().trim();
  if (l.includes("nepal") || l === "np") return "nepal";
  if (l.includes("united states") || l === "usa" || l === "us") return "us";
  return null;
}

/**
 * The per-track column patch for a decision. profiles.verification_status /
 * verified_at / bridge are GENERATED — never write them; writing these base
 * columns is what drives them (and the user_trust_tiers view) automatically.
 */
export function trackUpdate(track: PolicyTrack, decision: "verified" | "rejected") {
  const at = decision === "verified" ? new Date().toISOString() : null;
  return track === "us"
    ? { us_verification: decision, us_verified_at: at }
    : { np_verification: decision, np_verified_at: at };
}

export type DecisionInput = {
  approve: boolean;
  signal: LightSignal;
  reason?: string | null;
  credentialCheckNeeded?: boolean;
  /** Whatever the submitter already recorded; preserved, never clobbered. */
  existingChecks?: Record<string, unknown> | null;
  decidedAt?: string;
};

/**
 * Build the `checks` jsonb written alongside the decision. The submitter's
 * original payload is preserved under its existing keys and the review is
 * layered on top, so the record keeps both what was claimed and what was seen.
 */
export function buildDecisionChecks(input: DecisionInput): Record<string, unknown> {
  const {
    approve,
    signal,
    reason,
    credentialCheckNeeded = false,
    existingChecks,
    decidedAt = new Date().toISOString(),
  } = input;

  const trimmed = (reason ?? "").trim();

  return {
    ...(existingChecks ?? {}),
    review: {
      model: "light",
      signal,
      decision: approve ? "approved" : "rejected",
      // Only carry a reason when one was actually given — an empty string in an
      // audit record reads as "a reason was recorded" when none was.
      ...(trimmed ? { reason: trimmed } : {}),
      credential_check_needed: credentialCheckNeeded,
      decided_at: decidedAt,
    },
  };
}
