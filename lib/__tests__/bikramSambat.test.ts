import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BSToAD } from "bikram-sambat-js";
import { adToBS, formatBSDate, toNepaliDigits, BS_MONTHS } from "../bikramSambat";

// Correctness proof for the whole Nepali-calendar feature. EVERY expected value
// was produced by RUNNING the conversion, never hand-computed (a hand-computed
// 2082/09/17 for 2026-01-01 is exactly what slipped through the first time). The
// values are timezone-independent because adToBS forces the conversion into a UTC
// frame — bikram-sambat-js is otherwise wrong by 1–2 days outside UTC. This first
// block checks the anchors in the ambient timezone; the "timezone-independent"
// block below re-checks them under an explicit zone matrix.
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

// The bug that shipped twice was timezone-dependence, so it gets a real matrix.
// We drive the runner's timezone via process.env.TZ (which Node honors at RUNTIME,
// unlike a startup `TZ=...` which some platforms — Windows — silently ignore for
// IANA names; that ignore is how a "verified in Kathmandu" claim was made from a
// box that never left New_York). Asia/Kathmandu is a REQUIRED named zone here —
// it is the zone this feature is for and the one the earlier prototype fix got
// wrong (+2 days). For the fixed-offset zones we assert the offset ACTUALLY
// engaged, so a platform that ignores runtime TZ fails loudly instead of passing
// by testing one zone six times.
describe("adToBS is timezone-independent", () => {
  const ZONES: { tz: string; fixedOffset?: number }[] = [
    { tz: "UTC", fixedOffset: 0 },
    { tz: "America/New_York" }, // DST → 240/300, not asserted
    { tz: "Asia/Kathmandu", fixedOffset: -345 }, // the audience zone; no DST
    { tz: "Asia/Kolkata", fixedOffset: -330 }, // no DST
    { tz: "America/Los_Angeles" }, // DST → 420/480, not asserted
    { tz: "Pacific/Kiritimati", fixedOffset: -840 }, // +14, no DST
  ];

  let savedTZ: string | undefined;
  beforeEach(() => {
    savedTZ = process.env.TZ;
  });
  afterEach(() => {
    if (savedTZ === undefined) delete process.env.TZ;
    else process.env.TZ = savedTZ;
  });

  for (const { tz, fixedOffset } of ZONES) {
    it(`is correct in ${tz}`, () => {
      process.env.TZ = tz;
      if (fixedOffset !== undefined) {
        // Guard: prove the zone engaged (else the test proves nothing).
        expect(new Date().getTimezoneOffset()).toBe(fixedOffset);
      }
      // Same three anchors, must be identical in every zone.
      expect(adToBS(new Date(2026, 3, 14))).toEqual({ year: 2083, month: 1, day: 1 }); // New Year → Baishakh 1
      expect(adToBS(new Date(2026, 0, 1))).toEqual({ year: 2082, month: 9, day: 16 }); // interior
      expect(adToBS(new Date(1943, 3, 14))).toEqual({ year: 2000, month: 1, day: 1 }); // epoch
    });
  }
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
