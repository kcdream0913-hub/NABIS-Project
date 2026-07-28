import type { PolicyTrack } from "@/lib/kyc";

// Professional (individual) registration payloads — BL-NAV-01 fix 6.
//
// LOAD-BEARING: profiles.us_verification / np_verification are pinned by the DB
// trigger trg_protect_profile_trust (private.is_trusted_writer() = admin-or-null),
// so a member's own write to a track column is silently discarded. Therefore the
// profile update here NEVER touches a track column; the track is set later by admin
// review of the verification_records row (subject_type='user', status='pending'),
// exactly like the existing /profile/verify flow. The unit test asserts the
// exclusion so a future edit can't reintroduce the silently-pinned write.

export type ProfessionalFields = {
  name: string;
  headline: string; // -> profiles.bio
  city: string;
  sectors: string[];
};

/** Member-editable profile columns ONLY — no trust/track columns, ever. */
export function buildProfileUpdate(f: ProfessionalFields): Record<string, unknown> {
  return {
    name: f.name.trim(),
    bio: f.headline.trim(),
    city: f.city.trim(),
    sectors: f.sectors,
  };
}

export const TRACK_COUNTRY: Record<PolicyTrack, string> = { us: "United States", nepal: "Nepal" };

export type VerificationEvidence = {
  profession: string;
  attestation: string;
};

/** The verification_records row. Mirrors /profile/verify's shape so the admin queue
 *  (which reads subject_type='user', status='pending') surfaces it identically.
 *  Self-attested (light model); it sets policy_track but no track column on profiles. */
export function buildVerificationRecord(
  userId: string,
  track: PolicyTrack,
  ev: VerificationEvidence,
) {
  return {
    subject_type: "user" as const,
    subject_id: userId,
    provider: "pending_integration" as const,
    document_type: "self-attestation",
    document_country: TRACK_COUNTRY[track],
    policy_track: track,
    checks: {
      profession: ev.profession.trim(),
      attestation: ev.attestation.trim(),
      source: "professional_registration",
    },
    status: "pending" as const,
  };
}
