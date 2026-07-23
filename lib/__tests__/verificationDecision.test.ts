import { describe, it, expect } from "vitest";
import { trackForCountry, trackUpdate, buildDecisionChecks } from "../verificationDecision";

describe("trackForCountry", () => {
  it("maps corridor countries onto their policy track", () => {
    expect(trackForCountry("Nepal")).toBe("nepal");
    expect(trackForCountry("np")).toBe("nepal");
    expect(trackForCountry("United States")).toBe("us");
    expect(trackForCountry("USA")).toBe("us");
    expect(trackForCountry("us")).toBe("us");
  });

  it("returns null when the track cannot be inferred, rather than guessing", () => {
    // policy_track is NOT NULL, so the reviewer must choose explicitly instead
    // of the UI silently recording the wrong regulator's track.
    expect(trackForCountry("India")).toBeNull();
    expect(trackForCountry("")).toBeNull();
    expect(trackForCountry(null)).toBeNull();
    expect(trackForCountry(undefined)).toBeNull();
  });
});

describe("trackUpdate", () => {
  it("writes only the base per-track columns, never the generated ones", () => {
    const patch = trackUpdate("us", "verified");
    expect(Object.keys(patch).sort()).toEqual(["us_verification", "us_verified_at"]);
    // Guards the exact bug that made approvals silently ineffective in prod.
    expect(patch).not.toHaveProperty("verification_status");
    expect(patch).not.toHaveProperty("verified_at");
    expect(patch).not.toHaveProperty("bridge");
  });

  it("targets the nepal columns for the nepal track", () => {
    const patch = trackUpdate("nepal", "verified") as Record<string, unknown>;
    expect(patch.np_verification).toBe("verified");
    expect(patch.np_verified_at).toBeTypeOf("string");
  });

  it("clears the verified timestamp on rejection", () => {
    const patch = trackUpdate("us", "rejected") as Record<string, unknown>;
    expect(patch.us_verification).toBe("rejected");
    expect(patch.us_verified_at).toBeNull();
  });
});

describe("buildDecisionChecks", () => {
  const at = "2026-07-23T00:00:00.000Z";

  it("records the light signal, decision and flag", () => {
    const checks = buildDecisionChecks({
      approve: true,
      signal: "self_attestation",
      credentialCheckNeeded: true,
      decidedAt: at,
    });
    expect(checks.review).toEqual({
      model: "light",
      signal: "self_attestation",
      decision: "approved",
      credential_check_needed: true,
      decided_at: at,
    });
  });

  it("preserves what the submitter originally recorded", () => {
    const checks = buildDecisionChecks({
      approve: false,
      signal: "other",
      existingChecks: { captured: true },
      decidedAt: at,
    });
    expect(checks.captured).toBe(true);
    expect((checks.review as Record<string, unknown>).decision).toBe("rejected");
  });

  it("omits reason entirely when none was given, rather than storing an empty one", () => {
    const blank = buildDecisionChecks({ approve: true, signal: "reference", reason: "   ", decidedAt: at });
    expect(blank.review).not.toHaveProperty("reason");

    const given = buildDecisionChecks({ approve: true, signal: "reference", reason: "  vouched by NABIS board  ", decidedAt: at });
    expect((given.review as Record<string, unknown>).reason).toBe("vouched by NABIS board");
  });

  it("defaults credential_check_needed to false", () => {
    const checks = buildDecisionChecks({ approve: true, signal: "public_profile", decidedAt: at });
    expect((checks.review as Record<string, unknown>).credential_check_needed).toBe(false);
  });
});
