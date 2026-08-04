import { describe, it, expect } from "vitest";
import {
  isFeedbackKind,
  validateFeedbackBody,
  exceedsFeedbackRate,
  FEEDBACK_KINDS,
  FEEDBACK_BODY_MIN,
  FEEDBACK_BODY_MAX,
  FEEDBACK_RATE_MAX,
} from "../feedback";

describe("isFeedbackKind — the DB allowlist, in code", () => {
  it("accepts exactly the four allowed kinds", () => {
    expect(FEEDBACK_KINDS).toEqual(["bug", "idea", "confusing", "other"]);
    for (const k of FEEDBACK_KINDS) expect(isFeedbackKind(k)).toBe(true);
  });
  it("rejects anything else, including empties and non-strings", () => {
    for (const bad of ["spam", "Bug", "", " bug", null, undefined, 3, {}])
      expect(isFeedbackKind(bad)).toBe(false);
  });
});

describe("validateFeedbackBody — bounds match the DB CHECK (btrim, 10..4000)", () => {
  it("rejects 9 characters as too_short, accepts 10", () => {
    expect(validateFeedbackBody("a".repeat(9))).toEqual({ ok: false, error: "too_short" });
    const ten = validateFeedbackBody("a".repeat(FEEDBACK_BODY_MIN));
    expect(ten.ok).toBe(true);
    if (ten.ok) expect(ten.value).toHaveLength(10);
  });
  it("accepts 4000, rejects 4001 as too_long", () => {
    expect(validateFeedbackBody("a".repeat(FEEDBACK_BODY_MAX)).ok).toBe(true);
    expect(validateFeedbackBody("a".repeat(FEEDBACK_BODY_MAX + 1))).toEqual({
      ok: false,
      error: "too_long",
    });
  });
  it("trims before measuring — surrounding whitespace never satisfies the minimum", () => {
    // 8 real chars padded with whitespace to a raw length > 10 still fails.
    expect(validateFeedbackBody("   short    ")).toEqual({ ok: false, error: "too_short" });
    const trimmed = validateFeedbackBody("  exactly-ten  ");
    expect(trimmed.ok).toBe(true);
    if (trimmed.ok) expect(trimmed.value).toBe("exactly-ten"); // returns the trimmed value
  });
});

describe("exceedsFeedbackRate — 5 per rolling hour", () => {
  it("is false below the max and true at or above it", () => {
    expect(FEEDBACK_RATE_MAX).toBe(5);
    expect(exceedsFeedbackRate(0)).toBe(false);
    expect(exceedsFeedbackRate(4)).toBe(false); // the 5th submission is still allowed
    expect(exceedsFeedbackRate(5)).toBe(true); // the 6th is blocked
    expect(exceedsFeedbackRate(9)).toBe(true);
  });
});
