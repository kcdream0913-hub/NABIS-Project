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
 * Convert an AD date to Bikram Sambat. Uses the date's LOCAL calendar day (so
 * "today" is the viewer's today, not a UTC boundary), formatting to YYYY-MM-DD
 * before handing to the converter. Returns null when the date is outside the
 * converter's supported range (AD 1913–2043) instead of throwing, so a caller
 * can simply hide the widget rather than crash.
 */
export function adToBS(date: Date): BSDate | null {
  const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
  try {
    const [y, m, d] = ADToBS(local).split("-").map(Number);
    if (!y || !m || !d) return null;
    return { year: y, month: m, day: d };
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
