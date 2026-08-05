import { describe, it, expect } from "vitest";
import { normalizeWebsite, normalizeProfileLinks } from "../socialLinks";

// BL-PROFILE-01. Only the NEW profile helpers are tested here — the existing social-platform
// suite (business/new/_lib/__tests__/socialLinks.test.ts) covers normalizeSocialLink[s] and still
// runs against the same (moved) module via its re-export.

describe("normalizeWebsite — any https host, same cleaning as social links", () => {
  it("accepts any host and keeps the path", () => {
    expect(normalizeWebsite("https://acme.example/team")).toBe("https://acme.example/team");
  });

  it("assumes https for scheme-less input", () => {
    expect(normalizeWebsite("acme.example")).toBe("https://acme.example/");
  });

  it("upgrades http: to https:", () => {
    expect(normalizeWebsite("http://acme.example/x")).toBe("https://acme.example/x");
  });

  it("strips query + hash (tracking)", () => {
    expect(normalizeWebsite("https://acme.example/x?utm_source=y#top")).toBe("https://acme.example/x");
  });

  it("rejects the dangerous schemes (javascript:, data:) that fail to parse as https", () => {
    // javascript:/data: prepend to "https://javascript:alert(1)" etc., which has an invalid port
    // and throws → null. normalizeWebsite is otherwise DELIBERATELY permissive: prepending https://
    // turns most scheme-y garbage ("ftp://x", "mailto:a@b") into a *benign* https URL, not null.
    // That is fine — normalizeWebsite is a WRITE-path UX helper; the load-bearing guard against a
    // directly-stored javascript:/data: value is the render-time https-only filter, tested below.
    expect(normalizeWebsite("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsite("data:text/html,evil")).toBeNull();
  });

  it("rejects an over-length URL and empty input", () => {
    expect(normalizeWebsite("https://acme.example/" + "a".repeat(400))).toBeNull();
    expect(normalizeWebsite("")).toBeNull();
    expect(normalizeWebsite("   ")).toBeNull();
  });
});

describe("normalizeProfileLinks — {field: url} shape (matches businesses.social_links)", () => {
  it("keeps valid social (allowlist) + website (any host), drops invalid + empty", () => {
    const out = normalizeProfileLinks({
      website: "acme.example",
      linkedin: "https://linkedin.com/in/x",
      instagram: "https://instagram.com/y?igshid=z",
      facebook: "https://evil.example.com/x", // wrong host for facebook → dropped
      tiktok: "", // empty → dropped
    });
    expect(out).toEqual({
      website: "https://acme.example/",
      linkedin: "https://linkedin.com/in/x",
      instagram: "https://instagram.com/y",
    });
  });

  it("gates social on the allowlist but website on any host", () => {
    expect(
      normalizeProfileLinks({ website: "https://anything.example/p", x: "https://not-x.example/a" }),
    ).toEqual({ website: "https://anything.example/p" }); // x on a non-allowlisted host dropped
  });

  it("drops a javascript: website and ignores unknown keys", () => {
    expect(normalizeProfileLinks({ website: "javascript:alert(1)", bogus: "https://x.com/a" })).toEqual({});
  });

  it("empty input yields an empty object", () => {
    expect(normalizeProfileLinks({})).toEqual({});
  });
});

// The render-time boundary: components/ProfileLinks re-runs normalizeProfileLinks on the raw,
// client-writable profiles.links jsonb, so the FULL validator (allowlist for platforms, any-host
// https for website) — not a scheme-prefix check — decides what renders. These cover the attacks a
// mere https-prefix check would MISS.
describe("normalizeProfileLinks as the render re-validator (untrusted stored jsonb)", () => {
  it("neutralises the exact adversarial payload — brand-spoof linkedin + javascript website", () => {
    // linkedin on evil.example is https (a prefix check would pass it) but renders with LinkedIn's
    // icon+name → phishing → dropped. javascript website → dropped. Nothing renders.
    expect(
      normalizeProfileLinks({
        linkedin: "https://evil.example/harvest",
        website: "javascript:alert(1)",
      }),
    ).toEqual({});
  });

  it("drops a wrong-host platform link, data:, non-string, and object jsonb values", () => {
    expect(
      normalizeProfileLinks({
        facebook: "https://not-facebook.evil/x", // https but wrong host → dropped
        instagram: "data:text/html,evil", // unparseable → dropped
        x: 12345, // non-string → coerced to "" → dropped
        youtube: { u: "https://youtube.com/@x" }, // object → dropped
      }),
    ).toEqual({});
  });

  it("keeps genuine allowlisted platform links (upgrading http→https) and an any-host website", () => {
    expect(
      normalizeProfileLinks({
        linkedin: "https://www.linkedin.com/in/x",
        facebook: "http://facebook.com/x", // http on an allowlisted host → upgraded, kept
        website: "https://my.site",
      }),
    ).toEqual({
      facebook: "https://facebook.com/x",
      linkedin: "https://www.linkedin.com/in/x",
      website: "https://my.site/",
    });
  });
});
