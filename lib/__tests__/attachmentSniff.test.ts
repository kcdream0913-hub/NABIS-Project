import { describe, it, expect } from "vitest";
import { sniffMagic, ALLOWED_MIME } from "../attachmentSniff";

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
