import { describe, it, expect } from "vitest";
import { BSToAD } from "bikram-sambat-js";
import { adToBS, formatBSDate, toNepaliDigits, BS_MONTHS } from "../bikramSambat";

// These anchors are the load-bearing correctness proof for the whole Nepali
// calendar feature. EVERY expected value below was produced by running the
// conversion, not hand-computed — a hand-computed value (2082/09/17 for
// 2026-01-01) is exactly what slipped through before and it was wrong. The
// values are also TIMEZONE-INDEPENDENT: adToBS runs the conversion in a UTC
// frame (see inUtcFrame), so the same intended day yields the same BS date in
// every zone — verified identical across UTC / America/New_York / Asia/Kathmandu
// / America/Los_Angeles. Before that fix these assertions passed only in the
// runner's own timezone (they passed on a New_York dev box, failed in UTC CI).
describe("adToBS", () => {
  it("maps the canonical BS epoch 1943-04-14 → 2000/01/01", () => {
    expect(adToBS(new Date(1943, 3, 14))).toEqual({ year: 2000, month: 1, day: 1 });
  });

  it("maps Nepali New Year 2024-04-13 → 2081/01/01 (Baishakh 1)", () => {
    expect(adToBS(new Date(2024, 3, 13))).toEqual({ year: 2081, month: 1, day: 1 });
  });

  it("maps this repo's own seeded anchor 2026-04-14 → 2083/01/01 (Baishakh 1)", () => {
    // supabase/migrations/20260724173650_trip_planner_v2.sql seeds
    // nepali-new-year dates.2026 = { start: "2026-04-14" }, and Nepali New Year
    // is always BS Baishakh 1 — so this ties the conversion to data the codebase
    // already trusts. This is the exact case the library got wrong (Baishakh 2)
    // outside UTC before the inUtcFrame fix.
    expect(adToBS(new Date(2026, 3, 14))).toEqual({ year: 2083, month: 1, day: 1 });
    // Round-trips: the reverse BSToAD lands back on the seeded AD date.
    expect(BSToAD("2083-01-01")).toBe("2026-04-14");
  });

  it("maps an interior date 2026-01-01 → 2082/09/16", () => {
    expect(adToBS(new Date(2026, 0, 1))).toEqual({ year: 2082, month: 9, day: 16 });
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
