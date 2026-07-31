import { describe, it, expect } from "vitest";
import { adToBS, formatBSDate, toNepaliDigits, BS_MONTHS } from "../bikramSambat";

// These anchors are the load-bearing correctness proof for the whole Nepali
// calendar feature: they were cross-validated against a second, independent BS
// implementation before the library was chosen. A wrong month length in the
// underlying table would shift a whole year's dates — these pin the two most
// authoritative reference points (the epoch + Nepali New Year) plus one interior
// date. Dates are built with new Date(y, mIndex, d) so they are LOCAL calendar
// days, matching adToBS's local-day reading regardless of the runner's timezone.
describe("adToBS", () => {
  it("maps the canonical BS epoch 1943-04-14 → 2000/01/01", () => {
    expect(adToBS(new Date(1943, 3, 14))).toEqual({ year: 2000, month: 1, day: 1 });
  });

  it("maps Nepali New Year 2024-04-13 → 2081/01/01 (Baishakh 1)", () => {
    expect(adToBS(new Date(2024, 3, 13))).toEqual({ year: 2081, month: 1, day: 1 });
  });

  it("maps an interior date 2026-01-01 → 2082/09/17", () => {
    expect(adToBS(new Date(2026, 0, 1))).toEqual({ year: 2082, month: 9, day: 17 });
  });

  it("returns null outside the converter's supported range (never throws)", () => {
    expect(adToBS(new Date(1800, 0, 1))).toBeNull(); // before 1913
    expect(adToBS(new Date(2100, 0, 1))).toBeNull(); // after 2043
  });
});

describe("toNepaliDigits", () => {
  it("converts ASCII digits to Devanagari", () => {
    expect(toNepaliDigits(2083)).toBe("२०८३");
    expect(toNepaliDigits(17)).toBe("१७");
    expect(toNepaliDigits("2026-01")).toBe("२०२६-०१");
  });
});

describe("formatBSDate", () => {
  it("formats English with the Latin month name + ASCII digits", () => {
    expect(formatBSDate({ year: 2083, month: 3, day: 17 }, "en")).toBe("Ashadh 17, 2083");
  });

  it("formats Nepali with the Devanagari month name + digits", () => {
    expect(formatBSDate({ year: 2083, month: 3, day: 17 }, "ne")).toBe("असार १७, २०८३");
  });

  it("has 12 month names in both scripts", () => {
    expect(BS_MONTHS).toHaveLength(12);
    expect(BS_MONTHS.every((m) => m.en && m.ne)).toBe(true);
  });
});
