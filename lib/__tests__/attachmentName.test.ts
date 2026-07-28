import { describe, it, expect } from "vitest";
import { sanitizeFilename } from "../attachmentName";
import { BIDI_SPOOF_FILENAME, BIDI_CONTROLS, DEVANAGARI } from "./fixtures/unicode";

// Build the dangerous characters numerically so this source file stays pure ASCII.
const cc = (n: number) => String.fromCharCode(n);
const RLO = cc(0x202e); // right-to-left override
const LRI = cc(0x2066); // left-to-right isolate
const PDI = cc(0x2069); // pop directional isolate
const LRM = cc(0x200e); // left-to-right mark
const NUL = cc(0x00);
const TAB = cc(0x09);

describe("sanitizeFilename — bidi-override spoof (the headline threat)", () => {
  it("strips U+202E so the real extension is visible, not spoofed", () => {
    // "invoice" + RLO + "gpj.exe" renders as "invoiceexe.jpg" without sanitization.
    // After stripping the override the true ".exe" is visible again.
    const out = sanitizeFilename("invoice" + RLO + "gpj.exe");
    expect(out).toBe("invoicegpj.exe");
    expect(out).not.toContain(RLO);
  });
  it("strips isolates and directional marks", () => {
    expect(sanitizeFilename("a" + LRI + "b" + PDI + "c" + LRM + "d")).toBe("abcd");
  });
});

describe("sanitizeFilename — control chars + whitespace", () => {
  it("removes C0/C1 controls including NUL and tab", () => {
    expect(sanitizeFilename("report" + NUL + "name" + TAB + ".pdf")).toBe("reportname.pdf");
  });
  it("collapses whitespace and trims", () => {
    expect(sanitizeFilename("  my    file  .pdf ")).toBe("my file .pdf");
  });
  it("replaces path separators", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("..-..-etc-passwd");
    expect(sanitizeFilename("a\\b\\c.txt")).toBe("a-b-c.txt");
  });
});

describe("sanitizeFilename — length cap keeps the extension", () => {
  it("truncates long names but preserves a short extension", () => {
    const out = sanitizeFilename("x".repeat(200) + ".pdf", 40);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith(".pdf")).toBe(true);
    expect(out).toContain("…"); // ellipsis
  });
  it("empty / whitespace-only falls back to a safe default", () => {
    expect(sanitizeFilename("")).toBe("file");
    expect(sanitizeFilename("   ")).toBe("file");
    expect(sanitizeFilename(null)).toBe("file");
    expect(sanitizeFilename(undefined)).toBe("file");
  });
});

// Retro-applied shared fixture (BL-E2E-01): the same corpus every text-handling
// module is tested against, so a regression in one is caught by the convention.
describe("sanitizeFilename — shared Unicode fixture", () => {
  it("neutralizes the canonical bidi-spoof filename", () => {
    const out = sanitizeFilename(BIDI_SPOOF_FILENAME);
    expect(out).toBe("invoicegpj.exe"); // real ".exe" visible again
    expect(BIDI_CONTROLS.every((c) => !out.includes(c))).toBe(true);
  });
  it("strips every bidi/format control in the set", () => {
    for (const c of BIDI_CONTROLS) expect(sanitizeFilename("a" + c + "b")).toBe("ab");
  });
  it("does NOT over-strip real non-ASCII text (Devanagari survives)", () => {
    const out = sanitizeFilename(DEVANAGARI + ".pdf");
    expect(out.endsWith(".pdf")).toBe(true);
    expect(out).not.toBe("file");
    expect(BIDI_CONTROLS.every((c) => !out.includes(c))).toBe(true);
  });
});
