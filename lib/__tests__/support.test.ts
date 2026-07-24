import { describe, it, expect } from "vitest";
import { canRequestVerification, SUPPORT_ADMIN_ID } from "../support";

describe("canRequestVerification", () => {
  it("is hidden for the admin themselves (the only case that 400s)", () => {
    expect(canRequestVerification(SUPPORT_ADMIN_ID)).toBe(false);
  });
  it("is shown for any other member", () => {
    expect(canRequestVerification("11111111-1111-1111-1111-111111111111")).toBe(true);
  });
  it("is hidden when the user id is unknown", () => {
    expect(canRequestVerification(null)).toBe(false);
    expect(canRequestVerification(undefined)).toBe(false);
    expect(canRequestVerification("")).toBe(false);
  });
});
