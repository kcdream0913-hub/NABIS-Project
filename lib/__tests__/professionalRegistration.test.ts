import { describe, it, expect } from "vitest";
import { buildProfileUpdate, buildVerificationRecord } from "../professionalRegistration";

// Trust/track columns that trg_protect_profile_trust pins — a member write to any
// of these is silently discarded, so the profile-update payload must never contain
// one (else the form would appear to succeed while doing nothing).
const PINNED = [
  "us_verification",
  "np_verification",
  "verification_status",
  "verified_at",
  "us_verified_at",
  "np_verified_at",
  "bridge",
];

describe("buildProfileUpdate", () => {
  it("emits only trimmed member-editable profile fields", () => {
    const p = buildProfileUpdate({ name: " Kris ", headline: " Founder ", city: " NYC ", sectors: ["technology-ai"] });
    expect(p).toEqual({ name: "Kris", bio: "Founder", city: "NYC", sectors: ["technology-ai"] });
  });

  it("NEVER includes a pinned trust/track column", () => {
    const p = buildProfileUpdate({ name: "A", headline: "b", city: "c", sectors: [] });
    for (const k of PINNED) expect(p).not.toHaveProperty(k);
  });
});

describe("buildVerificationRecord", () => {
  it("is a pending, self-attested, subject=user record for the chosen track", () => {
    const r = buildVerificationRecord("u1", "us", { profession: "Lawyer", attestation: "Bar #123" });
    expect(r).toMatchObject({
      subject_type: "user",
      subject_id: "u1",
      policy_track: "us",
      status: "pending",
      document_country: "United States",
    });
    expect(r.checks).toMatchObject({ profession: "Lawyer", source: "professional_registration" });
  });

  it("maps the Nepal track to the right country and touches no track column", () => {
    const r = buildVerificationRecord("u2", "nepal", { profession: "Engineer", attestation: "PE" });
    expect(r.document_country).toBe("Nepal");
    for (const k of PINNED) expect(r).not.toHaveProperty(k);
  });
});
