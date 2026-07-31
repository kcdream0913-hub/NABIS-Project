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
 * Run `fn` with Date's LOCAL calendar getters (getFullYear/getMonth/getDate)
 * temporarily routed to their UTC equivalents, restored in a finally.
 *
 * Why this is necessary: bikram-sambat-js builds internal reference dates by
 * UTC-parsing "YYYY-MM-DD" strings (`new Date(str)`) and then reads their LOCAL
 * `.getDate()`, so its AD→BS result is only correct when the JS runtime is UTC.
 * Verified wrong by one day in BOTH America/New_York AND Asia/Kathmandu — the two
 * timezones this app actually runs in — e.g. Nepali New Year 2026-04-14 converts
 * to Baishakh 2 instead of Baishakh 1. A browser can't set its timezone, so we
 * neutralise the locality for the duration of the conversion instead. The call is
 * synchronous and never awaits, and JS is single-threaded, so nothing else
 * observes the swap. Verified identical across UTC / New_York / Kathmandu / LA.
 */
function inUtcFrame<T>(fn: () => T): T {
  const proto = Date.prototype;
  const saved = { getFullYear: proto.getFullYear, getMonth: proto.getMonth, getDate: proto.getDate };
  proto.getFullYear = proto.getUTCFullYear;
  proto.getMonth = proto.getUTCMonth;
  proto.getDate = proto.getUTCDate;
  try {
    return fn();
  } finally {
    proto.getFullYear = saved.getFullYear;
    proto.getMonth = saved.getMonth;
    proto.getDate = saved.getDate;
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
