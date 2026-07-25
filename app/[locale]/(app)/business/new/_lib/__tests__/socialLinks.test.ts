import { describe, it, expect } from "vitest";
import { normalizeSocialLink, normalizeSocialLinks } from "../socialLinks";

describe("normalizeSocialLink (§9)", () => {
  it("accepts a valid Facebook URL", () => {
    expect(normalizeSocialLink("facebook", "https://facebook.com/himalayafreight")).toBe(
      "https://facebook.com/himalayafreight",
    );
  });

  it("accepts a valid LinkedIn URL", () => {
    expect(normalizeSocialLink("linkedin", "https://www.linkedin.com/company/acme")).toBe(
      "https://www.linkedin.com/company/acme",
    );
  });

  it("strips query + hash (tracking params)", () => {
    expect(
      normalizeSocialLink("instagram", "https://instagram.com/acme?igshid=abc123&utm_source=x#top"),
    ).toBe("https://instagram.com/acme");
  });

  it("upgrades http: to https:", () => {
    expect(normalizeSocialLink("x", "http://x.com/acme")).toBe("https://x.com/acme");
  });

  it("rejects a non-allowlisted host", () => {
    expect(normalizeSocialLink("facebook", "https://evil.example.com/acme")).toBeNull();
    // right shape, wrong platform:
    expect(normalizeSocialLink("linkedin", "https://facebook.com/acme")).toBeNull();
  });

  it("rejects an over-length URL", () => {
    expect(normalizeSocialLink("facebook", "https://facebook.com/" + "a".repeat(400))).toBeNull();
  });

  it("passes empty input through as null", () => {
    expect(normalizeSocialLink("facebook", "")).toBeNull();
    expect(normalizeSocialLink("facebook", "   ")).toBeNull();
  });

  it("rejects path-traversal / non-url garbage", () => {
    expect(normalizeSocialLink("facebook", "javascript:alert(1)")).toBeNull();
    expect(normalizeSocialLink("facebook", "../../etc/passwd")).toBeNull();
  });
});

describe("normalizeSocialLinks bag", () => {
  it("keeps valid, drops invalid and empty", () => {
    const out = normalizeSocialLinks({
      facebook: "facebook.com/acme",
      linkedin: "https://linkedin.com/company/acme?trk=x",
      instagram: "",
      youtube: "https://evil.com/x",
    });
    expect(out).toEqual({
      facebook: "https://facebook.com/acme",
      linkedin: "https://linkedin.com/company/acme",
    });
  });
});
