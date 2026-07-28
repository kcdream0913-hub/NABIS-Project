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
  // csv/txt have no magic signature: both are accepted at UPLOAD (this list is the
  // bucket Content-Type allowlist) and sniff to "text/plain" at READ. sniffMagic()
  // never distinguishes csv from txt, so "text/csv" is reachable only via the
  // upload-side Content-Type — it is never RETURNED by the sniffer.
  "text/csv",
  "text/plain",
] as const;

// A window this large is enough to find the OOXML part names near the front of a
// docx/xlsx; the read route fetches this many head bytes when the full window is
// needed (ZIP/OOXML or text — see needsFullHead).
export const SNIFF_HEAD_BYTES = 64 * 1024;

// First-stage probe for the read route: enough to classify every binary signature
// (all <= 12 bytes) and every reject. Only ZIP/OOXML and text need the full window,
// so the common image/pdf/video case costs ~512B of egress instead of 64KB.
export const SNIFF_PROBE_BYTES = 512;

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
  // A recognized OOXML we don't allow in Phase 1 (e.g. pptx = "ppt/"). The `reason`
  // here is dev-only telemetry; the USER-facing message is the neutral "Unsupported
  // file type" (ThreadConversation maps any 403 → t("unsupportedType")), not a
  // security warning. If pptx should be supported, that is an allowlist addition
  // (accept type + "ppt/" branch + bucket mime), not a message change — KC decides.
  return rej("archive"); // pptx / other non-docx/xlsx OOXML → not supported
}

// csv/txt have no magic signature, so accept only if the head is STRUCTURALLY VALID
// UTF-8 per RFC 3629. This is a byte-domain walk that decodes each sequence to its
// codepoint, then rejects C0/DEL and C1 in the CODEPOINT domain — NOT by byte range.
// (The earlier version rejected bytes 0x7f–0x9f as "C1 controls", but 0x80–0x9f are
// legal UTF-8 CONTINUATION bytes; that dropped ~74% of non-ASCII BMP codepoints, so
// नमस्ते/emoji/em-dash text uploaded fine but 403'd on read. C1 is a codepoint range,
// not a byte range — attachmentName.ts strips it correctly because it iterates
// codepoints; here we must decode first.) A binary (exe, image, …) fails UTF-8
// structure at some byte and is rejected, so ".txt" cannot smuggle a payload.
function looksLikeText(b: Uint8Array): boolean {
  if (b.length === 0) return false;
  let i = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0; // skip UTF-8 BOM
  while (i < b.length) {
    const c = b[i];
    if (c < 0x80) {
      if (c === 0x09 || c === 0x0a || c === 0x0d) { i++; continue; } // tab/LF/CR
      if (c < 0x20 || c === 0x7f) return false;                      // C0 + DEL
      i++; continue;
    }
    let need: number, cp: number, min: number;
    if (c >= 0xc2 && c <= 0xdf)      { need = 1; cp = c & 0x1f; min = 0x80; }
    else if (c >= 0xe0 && c <= 0xef) { need = 2; cp = c & 0x0f; min = 0x800; }
    else if (c >= 0xf0 && c <= 0xf4) { need = 3; cp = c & 0x07; min = 0x10000; }
    else return false;                     // bare continuation / overlong lead / f5-ff
    if (i + need >= b.length) return true; // sequence cut by the head window — not a defect
    for (let k = 1; k <= need; k++) {
      const cc = b[i + k];
      if (cc < 0x80 || cc > 0xbf) return false;
      cp = (cp << 6) | (cc & 0x3f);
    }
    if (cp < min) return false;                     // overlong
    if (cp >= 0xd800 && cp <= 0xdfff) return false; // surrogate half
    if (cp > 0x10ffff) return false;
    if (cp >= 0x80 && cp <= 0x9f) return false;     // C1 — now in the CODEPOINT domain
    i += need + 1;
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
  if (at(b, [0x66, 0x74, 0x79, 0x70], 4)) {
    // 'ftyp' at offset 4 = ISO-BMFF, but the family also covers HEIC/HEIF/AVIF/JP2,
    // which share the box and would otherwise be mis-typed as video/mp4. Reject those
    // BRANDS explicitly (a trapdoor if any ever joins the accept list) via a
    // reject-list, not an allow-list, so legitimate mp4 brands (isom/mp41/…) pass.
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1", "avif", "avis", "jp2 ", "jpx "].includes(brand))
      return rej("unknown");
    return ok("video/mp4", "video");
  }
  if (at(b, [0x25, 0x50, 0x44, 0x46])) return ok("application/pdf", "document"); // %PDF

  // ── ZIP family → OOXML discrimination (docx/xlsx) vs generic archive ──
  if (at(b, [0x50, 0x4b, 0x03, 0x04]) || at(b, [0x50, 0x4b, 0x05, 0x06]) || at(b, [0x50, 0x4b, 0x07, 0x08])) {
    return sniffZip(b);
  }

  // ── text formats (no signature) ──
  if (looksLikeText(b)) return ok("text/plain", "text");

  return rej("unknown");
}

/**
 * Two-stage read decision (P2e): given a first-stage probe (SNIFF_PROBE_BYTES), does
 * the caller need to refetch the full SNIFF_HEAD_BYTES window before sniffing?
 *   - PK (ZIP/OOXML): the "[Content_Types].xml" + "word/"|"xl/" part names can sit
 *     past 512B, so a docx/xlsx would be mis-rejected on a short probe → refetch.
 *   - text: we validate a larger sample than 512B before accepting csv/txt → refetch.
 *   - everything else: every binary signature and every reject is decided within the
 *     first few bytes, so the probe alone is sufficient (no refetch).
 */
export function needsFullHead(probe: Uint8Array): boolean {
  if (at(probe, [0x50, 0x4b])) return true; // PK — any ZIP/OOXML
  return looksLikeText(probe);
}
