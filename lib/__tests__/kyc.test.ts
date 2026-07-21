import { describe, it, expect } from "vitest";
import { isBridgeEligible, type PolicyTrack, type TrackStatus } from "../kyc";

// Bridge = BOTH tracks passed, not either — this is a deliberate product
// decision (CLAUDE.md, 2026-07-21), not an implementation detail. These
// tests exist specifically to catch a future "simplify this to ||" mistake.
describe("isBridgeEligible", () => {
  const make = (us: TrackStatus, nepal: TrackStatus): Record<PolicyTrack, TrackStatus> => ({ us, nepal });

  it("is eligible only when both tracks have passed", () => {
    expect(isBridgeEligible(make("passed", "passed"))).toBe(true);
  });

  it("is NOT eligible when only the US track has passed", () => {
    expect(isBridgeEligible(make("passed", "none"))).toBe(false);
    expect(isBridgeEligible(make("passed", "pending"))).toBe(false);
  });

  it("is NOT eligible when only the Nepal track has passed", () => {
    expect(isBridgeEligible(make("none", "passed"))).toBe(false);
    expect(isBridgeEligible(make("pending", "passed"))).toBe(false);
  });

  it("is NOT eligible when neither track has passed", () => {
    expect(isBridgeEligible(make("none", "none"))).toBe(false);
    expect(isBridgeEligible(make("pending", "pending"))).toBe(false);
    expect(isBridgeEligible(make("failed", "failed"))).toBe(false);
  });

  it("a failed track blocks eligibility even if the other passed", () => {
    expect(isBridgeEligible(make("passed", "failed"))).toBe(false);
  });
});
