import { describe, it, expect } from "vitest";
import {
  canPublishOfferings,
  defaultPublishTargetKey,
  targetKey,
  type PublishTarget,
} from "../offerings";

const biz = (id: string): PublishTarget => ({ type: "business", id, name: `Biz ${id}` });
const me: PublishTarget = { type: "profile" };

describe("targetKey", () => {
  it("uses the business id for a business target", () => {
    expect(targetKey(biz("abc"))).toBe("abc");
  });
  it("uses the literal 'profile' for a personal target", () => {
    expect(targetKey(me)).toBe("profile");
  });
});

describe("defaultPublishTargetKey", () => {
  // The bug: a user who owns a business got profile-owned by default, so the
  // offering never appeared on the business's Offerings tab. The default must
  // be the business.
  it("defaults to the single owned business, not personal", () => {
    expect(defaultPublishTargetKey([biz("b1"), me])).toBe("b1");
  });

  it("defaults to the first business when several are owned", () => {
    expect(defaultPublishTargetKey([biz("b1"), biz("b2"), me])).toBe("b1");
  });

  it("stays personal when no business is owned", () => {
    expect(defaultPublishTargetKey([me])).toBe("profile");
  });

  it("honours a preferred key (a ?business= deep link or current owner)", () => {
    expect(defaultPublishTargetKey([biz("b1"), biz("b2"), me], "b2")).toBe("b2");
  });

  it("ignores a preferred key that isn't among the targets", () => {
    expect(defaultPublishTargetKey([biz("b1"), me], "gone")).toBe("b1");
  });

  it("can be preferred back to personal even when a business is owned", () => {
    expect(defaultPublishTargetKey([biz("b1"), me], "profile")).toBe("profile");
  });
});

describe("canPublishOfferings gates the publish identities", () => {
  it("is true when tourism-hospitality is present", () => {
    expect(canPublishOfferings(["tourism-hospitality", "technology-ai"])).toBe(true);
  });
  it("is false without it", () => {
    expect(canPublishOfferings(["technology-ai"])).toBe(false);
  });
  it("is false for null / empty", () => {
    expect(canPublishOfferings(null)).toBe(false);
    expect(canPublishOfferings([])).toBe(false);
  });
});
