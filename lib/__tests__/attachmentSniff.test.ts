import { describe, it, expect } from "vitest";
import { sniffMagic, ALLOWED_MIME } from "../attachmentSniff";
import { VALID_TEXT_SAMPLES, toUtf8 } from "./fixtures/unicode";

// Build a byte array from a prefix (numbers) padded with zeros to a length, so the
// signature sits where the sniffer looks. For text tests we pass ASCII directly.
function bytes(prefix: number[], len = prefix.length): Uint8Array {
  const b = new Uint8Array(Math.max(len, prefix.length));
  b.set(prefix);
  return b;
}
function ascii(s: string): Uint8Array {
  return new Uint8Array([...s].map((c) => c.charCodeAt(0)));
}
// RIFF + 4 size bytes + WEBP (+ optional trailer). Uses numbers, never a string with
// embedded NULs, so this source file stays free of control bytes.
function webp(trailer: number[] = []): Uint8Array {
  return new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, ...trailer]);
}
// UTF-8 bytes for a string built from EXPLICIT codepoints — the source stays pure
// ASCII (no non-ASCII literal that a save could normalize / decompose), and
// TextEncoder gives the canonical UTF-8 encoding of those codepoints.
const enc = new TextEncoder();
function utf8(...codepoints: number[]): Uint8Array {
  return enc.encode(String.fromCodePoint(...codepoints));
}
// ISO-BMFF box: size + 'ftyp' + a 4-char major brand (space-padded to 4).
function ftyp(brand: string): Uint8Array {
  const b = brand.padEnd(4).slice(0, 4);
  return new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, ...ascii(b)]);
}
// Deterministic PRNG (no Math.random) so the pseudorandom sweep is reproducible.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("sniffMagic — allowlisted image/video/pdf signatures", () => {
  it("JPEG (FF D8 FF)", () => {
    expect(sniffMagic(bytes([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ ok: true, mime: "image/jpeg", kind: "image" });
  });
  it("PNG", () => {
    expect(sniffMagic(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toMatchObject({ ok: true, mime: "image/png" });
  });
  it("GIF87a and GIF89a", () => {
    expect(sniffMagic(ascii("GIF87a...."))).toMatchObject({ ok: true, mime: "image/gif" });
    expect(sniffMagic(ascii("GIF89a...."))).toMatchObject({ ok: true, mime: "image/gif" });
  });
  it("WebP (RIFF....WEBP)", () => {
    expect(sniffMagic(webp([0x56, 0x50, 0x38, 0x20]))).toMatchObject({ ok: true, mime: "image/webp" });
  });
  it("MP4 (ftyp at offset 4)", () => {
    const b = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    expect(sniffMagic(b)).toEqual({ ok: true, mime: "video/mp4", kind: "video" });
  });
  it("WebM (EBML)", () => {
    expect(sniffMagic(bytes([0x1a, 0x45, 0xdf, 0xa3]))).toEqual({ ok: true, mime: "video/webm", kind: "video" });
  });
  it("PDF (%PDF)", () => {
    expect(sniffMagic(ascii("%PDF-1.7"))).toEqual({ ok: true, mime: "application/pdf", kind: "document" });
  });
});

describe("sniffMagic — ZIP / OOXML discrimination", () => {
  const PK = [0x50, 0x4b, 0x03, 0x04];
  it("docx: PK + [Content_Types].xml + word/", () => {
    const b = new Uint8Array([...PK, ...ascii(" [Content_Types].xml ... word/document.xml ")]);
    expect(sniffMagic(b)).toMatchObject({ ok: true, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  });
  it("xlsx: PK + [Content_Types].xml + xl/", () => {
    const b = new Uint8Array([...PK, ...ascii(" [Content_Types].xml ... xl/workbook.xml ")]);
    expect(sniffMagic(b)).toMatchObject({ ok: true, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  });
  it("generic zip (no OOXML marker) -> rejected as archive", () => {
    const b = new Uint8Array([...PK, ...ascii(" evil.sh payload.bin ")]);
    expect(sniffMagic(b)).toEqual({ ok: false, reason: "archive" });
  });
  it("pptx (ppt/ only) -> rejected (not allowlisted)", () => {
    const b = new Uint8Array([...PK, ...ascii(" [Content_Types].xml ppt/presentation.xml ")]);
    expect(sniffMagic(b)).toEqual({ ok: false, reason: "archive" });
  });
});

describe("sniffMagic — executables/archives rejected outright", () => {
  it("MZ (.exe renamed .pdf still rejected)", () => {
    expect(sniffMagic(bytes([0x4d, 0x5a, 0x90]))).toEqual({ ok: false, reason: "executable" });
  });
  it("ELF", () => {
    expect(sniffMagic(bytes([0x7f, 0x45, 0x4c, 0x46]))).toEqual({ ok: false, reason: "executable" });
  });
  it("Mach-O + Java class (CAFEBABE)", () => {
    expect(sniffMagic(bytes([0xca, 0xfe, 0xba, 0xbe]))).toEqual({ ok: false, reason: "executable" });
  });
  it("shebang script", () => {
    expect(sniffMagic(ascii("#!/bin/sh"))).toEqual({ ok: false, reason: "executable" });
  });
  it("RAR / 7z / gzip / bzip2 / xz", () => {
    expect(sniffMagic(bytes([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]))).toMatchObject({ ok: false, reason: "archive" });
    expect(sniffMagic(bytes([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))).toMatchObject({ ok: false, reason: "archive" });
    expect(sniffMagic(bytes([0x1f, 0x8b, 0x08]))).toMatchObject({ ok: false, reason: "archive" });
    expect(sniffMagic(bytes([0x42, 0x5a, 0x68]))).toMatchObject({ ok: false, reason: "archive" });
    expect(sniffMagic(bytes([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]))).toMatchObject({ ok: false, reason: "archive" });
  });
});

describe("sniffMagic — text heuristic (csv/txt have no signature)", () => {
  it("plain UTF-8 text accepted as text/plain", () => {
    expect(sniffMagic(ascii("name,amount\nfoo,10\nbar,20\n"))).toEqual({ ok: true, mime: "text/plain", kind: "text" });
  });
  it("UTF-8 BOM text accepted", () => {
    const b = new Uint8Array([0xef, 0xbb, 0xbf, ...ascii("hello world")]);
    expect(sniffMagic(b)).toMatchObject({ ok: true, kind: "text" });
  });
  it("a .txt hiding a NUL byte is rejected (not real text)", () => {
    const b = new Uint8Array([0x68, 0x69, 0x00, 0x01, 0x02]);
    expect(sniffMagic(b)).toEqual({ ok: false, reason: "unknown" });
  });
  it("empty file is not text", () => {
    expect(sniffMagic(new Uint8Array([]))).toEqual({ ok: false, reason: "unknown" });
  });
});

// P0 — the old looksLikeText rejected bytes 0x80–0x9f as "C1 controls", but those are
// legal UTF-8 CONTINUATION bytes; every non-ASCII UGC file (Devanagari, CJK, accents,
// em/curly punctuation, emoji) failed on read with a 403. C1 is a CODEPOINT range, not
// a byte range — validated structurally here.
describe("sniffMagic — UTF-8 text accepts non-ASCII (P0)", () => {
  it("Devanagari (नमस्ते संसार) → text/plain", () => {
    const b = utf8(0x928, 0x92e, 0x938, 0x94d, 0x924, 0x947, 0x20, 0x938, 0x902, 0x938, 0x93e, 0x930, 0x0a);
    expect(sniffMagic(b)).toEqual({ ok: true, mime: "text/plain", kind: "text" });
  });
  it("accented + em-dash + curly quotes + ellipsis + bullet → text/plain", () => {
    // c a f é(00E9) space ü(00FC) b e r space —(2014) space “(201C) q u o t e ”(201D) space …(2026) space •(2022)
    const b = utf8(0x63, 0x61, 0x66, 0xe9, 0x20, 0xfc, 0x62, 0x65, 0x72, 0x20, 0x2014, 0x20, 0x201c, 0x71, 0x75, 0x6f, 0x74, 0x65, 0x201d, 0x20, 0x2026, 0x20, 0x2022);
    expect(sniffMagic(b)).toEqual({ ok: true, mime: "text/plain", kind: "text" });
  });
  it("CJK (你好世界) → text/plain", () => {
    expect(sniffMagic(utf8(0x4f60, 0x597d, 0x4e16, 0x754c, 0x0a))).toEqual({ ok: true, mime: "text/plain", kind: "text" });
  });
  it("emoji line (U+1F600) → text/plain", () => {
    expect(sniffMagic(utf8(0x1f600, 0x0a))).toEqual({ ok: true, mime: "text/plain", kind: "text" });
  });
  it("64KB of Devanagari truncated mid-sequence → text/plain (window cut is not a defect)", () => {
    const seq = [0xe0, 0xa4, 0xa8]; // न
    const parts: number[] = [];
    while (parts.length < 64 * 1024) parts.push(...seq);
    const truncated = new Uint8Array(parts.slice(0, parts.length - 1)); // drop 1 byte → last sequence incomplete
    expect(sniffMagic(truncated)).toEqual({ ok: true, mime: "text/plain", kind: "text" });
  });
});

describe("sniffMagic — malformed UTF-8 is NOT text (P0)", () => {
  it("bad continuation (C3 28)", () => {
    expect(sniffMagic(new Uint8Array([0xc3, 0x28]))).toEqual({ ok: false, reason: "unknown" });
  });
  it("overlong NUL (C0 80)", () => {
    expect(sniffMagic(new Uint8Array([0xc0, 0x80]))).toEqual({ ok: false, reason: "unknown" });
  });
  it("surrogate half (ED A0 80)", () => {
    expect(sniffMagic(new Uint8Array([0xed, 0xa0, 0x80]))).toEqual({ ok: false, reason: "unknown" });
  });
  it("NEL — a C1 codepoint (C2 85)", () => {
    expect(sniffMagic(new Uint8Array([0xc2, 0x85]))).toEqual({ ok: false, reason: "unknown" });
  });
  it("20000 pseudorandom 256-byte buffers, fixed seed → 0 accepted as text", () => {
    const rand = mulberry32(0x9e3779b9);
    let acceptedAsText = 0;
    for (let n = 0; n < 20000; n++) {
      const buf = new Uint8Array(256);
      for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(rand() * 256);
      const r = sniffMagic(buf);
      if (r.ok && r.kind === "text") acceptedAsText++;
    }
    expect(acceptedAsText).toBe(0);
  });
});

// P2a — the ftyp box is shared by HEIC/HEIF/AVIF/JP2, which must not be typed as
// video/mp4. Reject those BRANDS; legitimate mp4 brands still pass (reject-list, not
// allow-list, so unknown-but-valid mp4 brands are not collateral).
describe("sniffMagic — ftyp brand discrimination (P2a)", () => {
  it("HEIC/HEIF/AVIF brands are rejected, not typed as mp4", () => {
    expect(sniffMagic(ftyp("heic"))).toEqual({ ok: false, reason: "unknown" });
    expect(sniffMagic(ftyp("mif1"))).toEqual({ ok: false, reason: "unknown" });
    expect(sniffMagic(ftyp("avif"))).toEqual({ ok: false, reason: "unknown" });
  });
  it("real mp4 brands still pass (isom/mp41/iso2/qt)", () => {
    for (const brand of ["isom", "mp41", "iso2", "qt"]) {
      expect(sniffMagic(ftyp(brand))).toEqual({ ok: true, mime: "video/mp4", kind: "video" });
    }
  });
});

describe("sniffMagic — invariant", () => {
  it("every ok() result mime is in the allowlist", () => {
    const samples: Uint8Array[] = [
      bytes([0xff, 0xd8, 0xff]),
      bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ascii("GIF89a"),
      webp(),
      new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]),
      bytes([0x1a, 0x45, 0xdf, 0xa3]),
      ascii("%PDF"),
      new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...ascii("[Content_Types].xml word/")]),
      ascii("just text"),
    ];
    for (const s of samples) {
      const r = sniffMagic(s);
      expect(r.ok).toBe(true);
      if (r.ok) expect(ALLOWED_MIME as readonly string[]).toContain(r.mime);
    }
  });
});

// Retro-applied shared fixture (BL-E2E-01): the same corpus every text-handling
// module is tested against. This is the exact corpus the P0 sniffer bug failed on.
describe("sniffMagic — shared Unicode text fixture", () => {
  it("every valid non-ASCII text sample sniffs as text/plain", () => {
    for (const sample of VALID_TEXT_SAMPLES) {
      expect(sniffMagic(toUtf8(sample))).toEqual({ ok: true, mime: "text/plain", kind: "text" });
    }
  });
});
