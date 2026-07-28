// Server-side content-type detection by MAGIC BYTES (D-052). The client-supplied
// Content-Type and the filename extension are NEVER trusted for the security
// decision — only the leading bytes (and, for the two text formats that have no
// signature, a strict UTF-8-text heuristic). This is the load-bearing check that
// keeps an executable renamed "invoice.pdf" out of a DM: it runs in the signed-URL
// READ route before a URL is minted, so a malicious sender cannot deliver a blocked
// file even by inserting the message row directly.
//
// Pure + dependency-free so it unit-tests without a DB or a browser.

export type SniffKind = "image" | "video" | "document" | "text";

export type SniffResult =
  | { ok: true; mime: string; kind: SniffKind }
  | { ok: false; reason: "executable" | "archive" | "unknown" };

// Output MIME types we are willing to store/deliver. The sniffer only ever returns
// one of these (or a rejection); it never echoes a client-claimed type.
export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "text/csv",
  "text/plain",
] as const;

// A window this large is enough to find the OOXML part names near the front of a
// docx/xlsx; the read route fetches at least this many head bytes.
export const SNIFF_HEAD_BYTES = 64 * 1024;

function at(b: Uint8Array, sig: number[], offset = 0): boolean {
  if (b.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) if (b[offset + i] !== sig[i]) return false;
  return true;
}

const ok = (mime: string, kind: SniffKind): SniffResult => ({ ok: true, mime, kind });
const rej = (reason: "executable" | "archive" | "unknown"): SniffResult => ({ ok: false, reason });

// Local-file-header entry names in a ZIP are stored uncompressed as bytes, so an
// OOXML container reveals "[Content_Types].xml" + "word/"|"xl/" literally near the
// front. Decode the head as latin1 (1 byte → 1 char) and string-search it.
function latin1(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}

function sniffZip(b: Uint8Array): SniffResult {
  const head = latin1(b);
  if (!head.includes("[Content_Types].xml")) return rej("archive"); // generic zip/jar/apk
  if (head.includes("word/")) return ok("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "document");
  if (head.includes("xl/")) return ok("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "document");
  return rej("archive"); // OOXML we don't allow (e.g. pptx = ppt/) → reject
}

// csv/txt have no magic. Accept only if the head reads as text: no NUL byte and no
// C0/C1 control characters other than tab/CR/LF. A binary (exe, image, …) trips one
// of these and is rejected, so ".txt" cannot smuggle a payload.
function looksLikeText(b: Uint8Array): boolean {
  if (b.length === 0) return false;
  let i = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0; // skip UTF-8 BOM
  for (; i < b.length; i++) {
    const c = b[i];
    if (c === 0x00) return false; // NUL → binary
    if (c < 0x09) return false; // C0 below tab
    if (c > 0x0d && c < 0x20) return false; // C0 between CR and space
    if (c >= 0x7f && c <= 0x9f) return false; // DEL + C1 controls
    // bytes >= 0xA0 are legal UTF-8 continuation/lead bytes — allowed
  }
  return true;
}

/** Detect the true type of a file from its head bytes. Never trusts extension/MIME. */
export function sniffMagic(bytes: Uint8Array): SniffResult {
  const b = bytes;

  // ── explicit rejects: executables / installers / compressed archives ──
  if (at(b, [0x4d, 0x5a])) return rej("executable"); // MZ (PE: exe/dll/msi)
  if (at(b, [0x7f, 0x45, 0x4c, 0x46])) return rej("executable"); // ELF
  if (at(b, [0xfe, 0xed, 0xfa, 0xce]) || at(b, [0xfe, 0xed, 0xfa, 0xcf]) ||
      at(b, [0xcf, 0xfa, 0xed, 0xfe]) || at(b, [0xce, 0xfa, 0xed, 0xfe])) return rej("executable"); // Mach-O
  if (at(b, [0xca, 0xfe, 0xba, 0xbe])) return rej("executable"); // Mach-O fat / Java class
  if (at(b, [0x23, 0x21])) return rej("executable"); // #! shebang script
  if (at(b, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07])) return rej("archive"); // RAR
  if (at(b, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return rej("archive"); // 7z
  if (at(b, [0x1f, 0x8b])) return rej("archive"); // gzip
  if (at(b, [0x42, 0x5a, 0x68])) return rej("archive"); // bzip2
  if (at(b, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00])) return rej("archive"); // xz

  // ── allowlisted binary signatures ──
  if (at(b, [0xff, 0xd8, 0xff])) return ok("image/jpeg", "image");
  if (at(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return ok("image/png", "image");
  if (at(b, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) || at(b, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) return ok("image/gif", "image");
  if (at(b, [0x52, 0x49, 0x46, 0x46]) && at(b, [0x57, 0x45, 0x42, 0x50], 8)) return ok("image/webp", "image"); // RIFF….WEBP
  if (at(b, [0x1a, 0x45, 0xdf, 0xa3])) return ok("video/webm", "video"); // EBML (webm/mkv)
  if (at(b, [0x66, 0x74, 0x79, 0x70], 4)) return ok("video/mp4", "video"); // 'ftyp' at offset 4 (ISO-BMFF)
  if (at(b, [0x25, 0x50, 0x44, 0x46])) return ok("application/pdf", "document"); // %PDF

  // ── ZIP family → OOXML discrimination (docx/xlsx) vs generic archive ──
  if (at(b, [0x50, 0x4b, 0x03, 0x04]) || at(b, [0x50, 0x4b, 0x05, 0x06]) || at(b, [0x50, 0x4b, 0x07, 0x08])) {
    return sniffZip(b);
  }

  // ── text formats (no signature) ──
  if (looksLikeText(b)) return ok("text/plain", "text");

  return rej("unknown");
}
