// Deterministic E2E security fixtures for BL-MSG-05 (BL-E2E-01). GENERATED, never
// committed: the >50MB file would bloat the repo, and the bidi/Devanagari filenames
// should not live in git. e2e/global-setup.ts runs this before the suite; it is also
// runnable by hand:  node scripts/gen-e2e-fixtures.mjs
//
// Filenames with non-ASCII / bidi codepoints are built via String.fromCodePoint so
// THIS source stays pure ASCII (same discipline as lib/attachmentName.ts).
import { mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const cp = (...ns) => String.fromCodePoint(...ns);
const DEVANAGARI = cp(0x928, 0x92e, 0x938, 0x94d, 0x924, 0x947); // "namaste"
const RLO = cp(0x202e); // RIGHT-TO-LEFT OVERRIDE

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "e2e", "fixtures", "generated");

export function generateFixtures() {
  mkdirSync(DIR, { recursive: true });

  // 1) Executable (MZ / DOS header) wearing a .pdf name - the server magic-byte sniff
  //    must reject it regardless of extension/Content-Type (403 blocked-type).
  const mz = Buffer.alloc(2048);
  mz[0] = 0x4d; // 'M'
  mz[1] = 0x5a; // 'Z'
  writeFileSync(join(DIR, "invoice.pdf"), mz);

  // 2) Oversize file (> 50MB video cap) - rejected in the picker by the client size
  //    gate, before any network/sniff. Content is irrelevant; only the size matters.
  writeFileSync(join(DIR, "oversize.mp4"), Buffer.alloc(50 * 1024 * 1024 + 1));

  // 3) Valid CSV with a Devanagari basename - must upload (csv allowed, sniffs to
  //    text/plain) and its name must render intact (sanitizer keeps real text).
  writeFileSync(join(DIR, DEVANAGARI + ".csv"), "name,amount\nfoo,10\nbar,20\n", "utf8");

  // 4) Valid PDF whose name embeds a RIGHT-TO-LEFT OVERRIDE - bytes pass the sniff so
  //    it renders as a doc card, but the DISPLAYED name must be sanitized (no U+202E
  //    reaches the DOM). Visible extension stays ".pdf" so the client accepts it.
  const pdf = "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\nstartxref\n0\n%%EOF\n";
  writeFileSync(join(DIR, "report" + RLO + "fdp.pdf"), pdf, "utf8");

  // 5) Valid 1x1 PNG - a known-good image for the happy-path "upload renders" case.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64",
  );
  writeFileSync(join(DIR, "ok.png"), png);

  return DIR;
}

// Names the spec references. Built here (not hardcoded in the spec) so the bidi/
// Devanagari names have exactly one numeric definition.
export const FIXTURE_NAMES = {
  mzPdf: "invoice.pdf",
  oversize: "oversize.mp4",
  devanagariCsv: DEVANAGARI + ".csv",
  bidiPdf: "report" + RLO + "fdp.pdf",
  okPng: "ok.png",
};

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("gen-e2e-fixtures.mjs")) {
  const dir = generateFixtures();
  console.log("generated fixtures in", dir + ":", readdirSync(dir).length, "files");
}
