/**
 * Trust tier — the single mapping from stored verification state to the mark
 * the UI renders. Keep this the only place that decides a tier, so the badge,
 * the directory and any future surface cannot drift apart.
 *
 * The DB models exactly three observable states (see the baseline migration):
 *   - profiles.verification_status  GENERATED: 'verified' when EITHER the US or
 *     the Nepal track is verified, else 'unverified'
 *   - profiles.bridge               GENERATED: true only when BOTH tracks are
 *     verified — the corridor tier (D-014 / lib/kyc.ts isBridgeEligible)
 * There is deliberately no "basic" tier: the schema does not model one, and an
 * unverified subject renders no badge at all rather than a negative mark.
 *
 * Businesses carry verification_status but have no per-track columns and no
 * bridge, so they resolve to "verified" at most. Passing no `bridge` field is
 * therefore correct for a business, not a missing value.
 */
export type TrustTier = "none" | "verified" | "bridge";

export type TrustSubject = {
  verification_status?: string | null;
  /** Absent for businesses, which have no corridor tier. */
  bridge?: boolean | null;
};

export function trustTier(subject: TrustSubject | null | undefined): TrustTier {
  if (!subject) return "none";
  // verification_status is the gate: bridge is only meaningful once verified.
  // Guarding on it means a stale/forged bridge flag can never promote an
  // unverified subject into a badge.
  if (subject.verification_status !== "verified") return "none";
  return subject.bridge === true ? "bridge" : "verified";
}
