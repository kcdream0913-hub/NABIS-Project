import { ADToBS } from "bikram-sambat-js";

/**
 * Bikram Sambat (Nepali calendar) support. The AD↔BS month lengths are irregular
 * and vary per year, so the conversion needs the canonical government table —
 * we take it from the vetted, MIT-licensed, zero-dependency `bikram-sambat-js`
 * (cross-validated against a second independent implementation on the epoch
 * anchor 1943-04-14 = BS 2000/01/01 and Nepali New Year 2024-04-13 = BS 2081/01/01;
 * see the tests). This module is the ONLY place that imports the library, so a
 * future swap changes one file.
 */

// Nepali month names, index 0 = Baishakh (BS month 1). Bilingual DATA, not
// translation — fixed proper nouns with en/ne forms, so they live here alongside
// the other bilingual lib data (sector/festival labels), not in the i18n JSON.
export const BS_MONTHS: { en: string; ne: string }[] = [
  { en: "Baishakh", ne: "बैशाख" },
  { en: "Jestha", ne: "जेठ" },
  { en: "Ashadh", ne: "असार" },
  { en: "Shrawan", ne: "साउन" },
  { en: "Bhadra", ne: "भदौ" },
  { en: "Ashwin", ne: "असोज" },
  { en: "Kartik", ne: "कार्तिक" },
  { en: "Mangsir", ne: "मंसिर" },
  { en: "Poush", ne: "पुष" },
  { en: "Magh", ne: "माघ" },
  { en: "Falgun", ne: "फागुन" },
  { en: "Chaitra", ne: "चैत" },
];

export interface BSDate {
  year: number;
  month: number; // 1..12
  day: number;
}

const NE_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

/** Render an integer (or numeric string) in Devanagari digits. */
export function toNepaliDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => NE_DIGITS[Number(d)]);
}

/**
 * Run `fn` with the process timezone forced to UTC, restored in a finally.
 *
 * Why this is necessary: bikram-sambat-js's toBS()/toAD() build intermediate
 * dates with the LOCAL-time multi-arg constructor `new Date(y, m, d)` and mutate
 * them with `adDate.setDate(adDate.getDate() + n)`, so the conversion only lands
 * correctly when local time equals UTC — verified off by one/two days in every
 * non-UTC zone (e.g. Nepali New Year 2026-04-14 → Baishakh 2 instead of 1). We
 * force a single frame by overriding `process.env.TZ` for the duration of the
 * (synchronous, non-awaiting) call instead of patching Date methods: patching
 * only the getters left the constructor and setDate in local time, which netted
 * to zero for western offsets but +2 for eastern ones (Kathmandu, Kolkata) — the
 * zones this feature is FOR. Making local === UTC removes the frame entirely, so
 * there is no mismatch to get wrong. Verified identical + correct across UTC /
 * New_York / Kathmandu / Kolkata / Los_Angeles / Kiritimati (see the tests).
 *
 * NOTE: this is a Node-frame mechanism — `process.env.TZ` has no effect on a
 * browser's Date. See the browser caveat raised on this branch before relying on
 * this for a client-rendered "today".
 */
function inUtcFrame<T>(fn: () => T): T {
  const saved = process.env.TZ;
  process.env.TZ = "UTC";
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
}

/**
 * Convert an AD date to Bikram Sambat. The viewer's LOCAL calendar day is read
 * first (so "today" is their today), then the conversion runs in a UTC frame (see
 * inUtcFrame) so the library's timezone bug can't shift the result — the same
 * intended day yields the same BS date in every timezone. Returns null when the
 * date is outside the converter's supported range (AD 1913–2043) instead of
 * throwing, so a caller can simply hide the widget rather than crash.
 */
export function adToBS(date: Date): BSDate | null {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  try {
    const [by, bm, bd] = inUtcFrame(() => ADToBS(new Date(Date.UTC(y, m, d, 12, 0, 0))))
      .split("-")
      .map(Number);
    if (!by || !bm || !bd) return null;
    return { year: by, month: bm, day: bd };
  } catch {
    return null;
  }
}

/** "Ashadh 17, 2083" (en) / "असार १७, २०८३" (ne). Empty string on a bad month. */
export function formatBSDate(bs: BSDate, locale: string): string {
  const month = BS_MONTHS[bs.month - 1];
  if (!month) return "";
  if (locale === "ne") {
    return `${month.ne} ${toNepaliDigits(bs.day)}, ${toNepaliDigits(bs.year)}`;
  }
  return `${month.en} ${bs.day}, ${bs.year}`;
}
