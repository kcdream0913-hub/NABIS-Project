// Shared Unicode fixtures for any code that VALIDATES or TRANSFORMS user-entered
// text (BL-E2E-01 convention). Every character is built NUMERICALLY via
// String.fromCodePoint so the SOURCE of this file stays pure ASCII: no invisible
// bidi/control byte (and no ambiguous literal) can hide in a diff or mislead a
// reviewer, while the RUNTIME strings are the real characters. Same discipline as
// lib/attachmentName.ts.
//
// Convention: anything that validates or transforms user text (filename sanitizers,
// text sniffers, bio assemblers, search normalizers, etc.) is tested against these,
// so "works for ASCII, breaks for the corridor's actual scripts" cannot ship. The P0
// in BL-MSG-05 (a UTF-8 sniffer that rejected every Devanagari/CJK/emoji byte) is the
// exact failure this fixture exists to catch.

const cp = (...ns: number[]): string => String.fromCodePoint(...ns);

// -- valid, printable, non-ASCII text (MUST survive validation as real text) --
export const DEVANAGARI = cp(0x928, 0x92e, 0x938, 0x94d, 0x924, 0x947, 0x20, 0x938, 0x902, 0x938, 0x93e, 0x930); // "namaste sansaar"
export const CJK = cp(0x4f60, 0x597d, 0x4e16, 0x754c); // "ni hao shijie"
export const EMOJI = cp(0x1f600, 0x1f64f, 0x1f30f); // grinning face + folded hands + globe
export const SMART_PUNCT = cp(0x201c, 0x63, 0x61, 0x66, 0xe9, 0x201d, 0x20, 0x2014, 0x20, 0x2026, 0x20, 0x2022); // curly-quoted cafe + em dash + ellipsis + bullet
export const MIXED_SCRIPT = `${DEVANAGARI} ${CJK} ${SMART_PUNCT} ${EMOJI}`;
export const VALID_TEXT_SAMPLES: readonly string[] = [DEVANAGARI, CJK, EMOJI, SMART_PUNCT, MIXED_SCRIPT];

// -- dangerous format/control codepoints (MUST be stripped from display text) --
export const RLO = cp(0x202e); // RIGHT-TO-LEFT OVERRIDE: the filename-spoof headliner
export const LRI = cp(0x2066); // LEFT-TO-RIGHT ISOLATE
export const PDI = cp(0x2069); // POP DIRECTIONAL ISOLATE
export const LRM = cp(0x200e); // LEFT-TO-RIGHT MARK
// The full bidi/format set a sanitizer must remove: overrides/embeddings (202A-202E),
// isolates (2066-2069), LRM/RLM/ALM (200E/200F/061C).
export const BIDI_CONTROLS: readonly string[] = [
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0x200e, 0x200f, 0x061c,
].map((n) => cp(n));

// The canonical spoof: renders as "invoiceexe.jpg" unsanitized; the true ".exe" only
// reappears once the RLO is stripped.
export const BIDI_SPOOF_FILENAME = "invoice" + RLO + "gpj.exe";

/** UTF-8 bytes of a string, for byte-level validators (e.g. the attachment sniffer). */
export function toUtf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
