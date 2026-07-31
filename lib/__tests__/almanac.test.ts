import { describe, it, expect } from "vitest";
import { upcomingFestivals } from "../almanac";
import type { Festival } from "../offerings";

// Shaped like the real seeded `festivals` rows (see the BL-TRIP-01 seed): Nepal
// festivals carry a dated 2026 window; US-side slugs carry an empty `dates`.
const f = (over: Partial<Festival>): Festival => ({
  slug: "x",
  name: "X",
  name_ne: null,
  country: "np",
  month_hint: null,
  dates: {},
  ...over,
});

const TODAY = new Date(2026, 6, 31); // 2026-07-31, local

const FESTIVALS: Festival[] = [
  f({ slug: "teej", name: "Teej", name_ne: "तीज", dates: { "2026": { start: "2026-09-14", end: "2026-09-14" } } }),
  f({ slug: "indra-jatra", name: "Indra Jatra", dates: { "2026": { start: "2026-09-25", end: "2026-10-02" } } }),
  f({ slug: "dashain", name: "Dashain", dates: { "2026": { start: "2026-10-10", end: "2026-10-25" } } }),
  f({ slug: "tihar", name: "Tihar", dates: { "2026": { start: "2026-10-29", end: "2026-11-02" } } }),
  f({ slug: "holi", name: "Holi", dates: { "2026": { start: "2026-03-02", end: "2026-03-02" } } }), // past
  f({ slug: "dashain-us", name: "Dashain (US)", country: "us", dates: {} }), // no dated window
];

describe("upcomingFestivals", () => {
  it("returns only future-dated festivals, soonest first", () => {
    const up = upcomingFestivals(FESTIVALS, TODAY, "en");
    expect(up.map((u) => u.slug)).toEqual(["teej", "indra-jatra", "dashain", "tihar"]);
  });

  it("excludes past dates (holi) and festivals with no dated window (dashain-us)", () => {
    const slugs = upcomingFestivals(FESTIVALS, TODAY, "en").map((u) => u.slug);
    expect(slugs).not.toContain("holi");
    expect(slugs).not.toContain("dashain-us");
  });

  it("computes daysUntil from local midnight (0 = today, 1 = tomorrow)", () => {
    const up = upcomingFestivals(
      [
        f({ slug: "today", dates: { "2026": { start: "2026-07-31" } } }),
        f({ slug: "tomorrow", dates: { "2026": { start: "2026-08-01" } } }),
      ],
      TODAY,
      "en",
    );
    expect(up.find((u) => u.slug === "today")?.daysUntil).toBe(0);
    expect(up.find((u) => u.slug === "tomorrow")?.daysUntil).toBe(1);
  });

  it("picks the soonest FUTURE year when a festival has past and future occurrences", () => {
    const up = upcomingFestivals(
      [f({ slug: "cross", dates: { "2025": { start: "2025-01-01" }, "2027": { start: "2027-01-01" } } })],
      TODAY,
      "en",
    );
    expect(up).toHaveLength(1);
    expect(up[0].date).toBe("2027-01-01");
  });

  it("respects the limit", () => {
    expect(upcomingFestivals(FESTIVALS, TODAY, "en", 2).map((u) => u.slug)).toEqual(["teej", "indra-jatra"]);
  });

  it("uses the Nepali name in the ne locale, English otherwise", () => {
    expect(upcomingFestivals(FESTIVALS, TODAY, "ne").find((u) => u.slug === "teej")?.name).toBe("तीज");
    expect(upcomingFestivals(FESTIVALS, TODAY, "en").find((u) => u.slug === "teej")?.name).toBe("Teej");
  });
});
