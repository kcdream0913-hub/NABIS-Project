import { describe, it, expect } from "vitest";
import { trustTier } from "../trust";

// The badge is the only public signal of a member's standing, so the mapping
// from stored state to tier is pinned here. If someone later "simplifies" the
// verification_status guard away, the forged-bridge case below fails loudly.
describe("trustTier", () => {
  it("renders nothing for an unverified subject", () => {
    expect(trustTier({ verification_status: "unverified", bridge: false })).toBe("none");
  });

  it("returns verified when one track has passed (bridge false)", () => {
    expect(trustTier({ verification_status: "verified", bridge: false })).toBe("verified");
  });

  it("returns bridge only when both tracks have passed", () => {
    expect(trustTier({ verification_status: "verified", bridge: true })).toBe("bridge");
  });

  it("treats a business (no bridge column) as verified, never bridge", () => {
    // Businesses have no per-track columns, so `bridge` is absent — that is a
    // correct business shape, not missing data.
    expect(trustTier({ verification_status: "verified" })).toBe("verified");
    expect(trustTier({ verification_status: "unverified" })).toBe("none");
  });

  it("never promotes an unverified subject even if bridge is somehow true", () => {
    // bridge is a generated column, but the client receives it as plain JSON;
    // verification_status stays the gate so a bad payload cannot mint a badge.
    expect(trustTier({ verification_status: "unverified", bridge: true })).toBe("none");
  });

  it("is null-safe for a missing or absent subject", () => {
    expect(trustTier(null)).toBe("none");
    expect(trustTier(undefined)).toBe("none");
    expect(trustTier({})).toBe("none");
    expect(trustTier({ verification_status: null, bridge: null })).toBe("none");
  });
});
