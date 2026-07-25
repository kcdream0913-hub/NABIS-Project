import { describe, it, expect } from "vitest";
import { isPrivateAddress, assertPublicUrl, robotsDisallows, extractFromHtml } from "../websiteGuards";

describe("isPrivateAddress", () => {
  it("flags loopback / private / link-local / CGNAT v4", () => {
    for (const ip of ["127.0.0.1", "10.0.0.1", "172.16.5.4", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });
  it("flags v6 loopback / ULA / link-local", () => {
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("[::1]")).toBe(true);
    expect(isPrivateAddress("fc00::1")).toBe(true);
    expect(isPrivateAddress("fe80::1")).toBe(true);
  });
  it("allows public addresses", () => {
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("2606:4700:4700::1111")).toBe(false);
  });
});

describe("assertPublicUrl (SSRF guard) — fails closed", () => {
  it("rejects non-https schemes", async () => {
    expect((await assertPublicUrl("http://example.com")).ok).toBe(false);
    expect((await assertPublicUrl("file:///etc/passwd")).ok).toBe(false);
    expect((await assertPublicUrl("ftp://example.com")).ok).toBe(false);
  });
  it("rejects private / loopback / link-local literal IPs", async () => {
    for (const u of ["https://127.0.0.1", "https://10.0.0.1", "https://169.254.169.254", "https://[::1]", "https://192.168.1.1"]) {
      const r = await assertPublicUrl(u);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("private");
    }
  });
  it("blocks a redirect target that points at a private IP (the ship-broken case)", async () => {
    // The importer re-runs assertPublicUrl on each Location; this is that check.
    const r = await assertPublicUrl("https://192.168.1.1/dashboard");
    expect(r.ok).toBe(false);
  });
});

describe("robotsDisallows", () => {
  it("honors a Disallow for our UA / *", () => {
    expect(robotsDisallows("User-agent: *\nDisallow: /", "/")).toBe(true);
    expect(robotsDisallows("User-agent: *\nDisallow: /private", "/private/x")).toBe(true);
    expect(robotsDisallows("User-agent: *\nDisallow:", "/")).toBe(false);
    expect(robotsDisallows("User-agent: Googlebot\nDisallow: /", "/")).toBe(false);
  });
});

describe("extractFromHtml", () => {
  it("prefers JSON-LD, falls back to og/meta/title, filters sameAs to social hosts", () => {
    const html = `
      <title>Fallback Title</title>
      <meta property="og:description" content="og desc">
      <script type="application/ld+json">{"@type":"Organization","name":"Acme Nepal","description":"We do things","telephone":"+977 1 111","address":{"addressLocality":"Pokhara","streetAddress":"Lakeside"},"sameAs":["https://facebook.com/acme","https://evil.com/x"]}</script>
    `;
    const e = extractFromHtml(html);
    expect(e.name).toBe("Acme Nepal");
    expect(e.bio).toBe("We do things");
    expect(e.phone).toBe("+977 1 111");
    expect(e.city).toBe("Pokhara");
    expect(e.addressLine).toBe("Lakeside");
    expect(e.socialLinks).toContain("https://facebook.com/acme");
    expect(e.socialLinks).not.toContain("https://evil.com/x");
  });
});
