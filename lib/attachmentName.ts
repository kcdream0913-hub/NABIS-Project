// Display-filename sanitization (D-052). Applied when STORING attachment metadata
// AND again at RENDER, because a malicious sender can write the messages.attachments
// jsonb directly — the recipient's view must never trust it.
//
// The headline threat is the Unicode bidi-override spoof: a name built as
// "invoice" + U+202E + "gpj.exe" renders as "invoiceexe.jpg" in a naive UI, so a
// recipient on a platform full of people exchanging invoices double-clicks an
// executable. Stripping the override makes the real ".exe" visible again. We also
// drop other bidi/format controls and C0/C1 control chars, collapse whitespace, cap
// length (keeping the extension visible), and return plain text — the value is
// always rendered as a React text child (escaped), never as HTML.
//
// Codepoints are checked numerically (not via a regex literal) so the source stays
// pure ASCII — no invisible control/bidi bytes living in this file.
function isStripped(c: number): boolean {
  if (c <= 0x1f) return true; // C0 controls (incl. tab/LF/CR — removed from a name)
  if (c >= 0x7f && c <= 0x9f) return true; // DEL + C1 controls
  if (c >= 0x202a && c <= 0x202e) return true; // bidi overrides/embeddings
  if (c >= 0x2066 && c <= 0x2069) return true; // bidi isolates
  if (c === 0x200e || c === 0x200f || c === 0x061c) return true; // LRM/RLM/ALM
  return false;
}

export function sanitizeFilename(raw: string | null | undefined, max = 80): string {
  const input = (raw ?? "").normalize("NFC");
  let s = "";
  for (const ch of input) {
    const c = ch.codePointAt(0);
    if (c === undefined || isStripped(c)) continue;
    s += ch;
  }
  s = s.replace(/[\\/]+/g, "-"); // a display name never carries a path separator
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return "file";
  if (s.length > max) {
    const dot = s.lastIndexOf(".");
    const ext = dot > 0 && s.length - dot <= 8 ? s.slice(dot) : ""; // keep a short ext visible
    s = s.slice(0, Math.max(1, max - ext.length - 1)).trimEnd() + "…" + ext;
  }
  return s;
}
