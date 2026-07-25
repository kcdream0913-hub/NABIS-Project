import { describe, it, expect } from "vitest";
import { buildIcs, googleCalendarUrl, buildMonthGrid, type CalendarEvent } from "../calendar";

const EVENT: CalendarEvent = {
  id: "evt-1",
  title: "NABIS Summit, NYC",
  description: "Line one\nLine two",
  location: "New York, NY",
  startsAt: "2026-09-26T14:00:00Z",
  endsAt: "2026-09-26T18:00:00Z",
};

describe("buildIcs", () => {
  it("wraps a single VEVENT with CRLF line endings", () => {
    const ics = buildIcs(EVENT);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics.endsWith("END:VCALENDAR")).toBe(true);
  });
  it("emits UTC basic-format DTSTART/DTEND", () => {
    const ics = buildIcs(EVENT);
    expect(ics).toContain("DTSTART:20260926T140000Z");
    expect(ics).toContain("DTEND:20260926T180000Z");
  });
  it("escapes commas and newlines", () => {
    const ics = buildIcs(EVENT);
    expect(ics).toContain("SUMMARY:NABIS Summit\\, NYC");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
  });
  it("defaults to a 60-minute DTEND when endsAt is absent", () => {
    const ics = buildIcs({ ...EVENT, endsAt: null });
    expect(ics).toContain("DTEND:20260926T150000Z");
  });
});

describe("googleCalendarUrl", () => {
  it("builds a prefilled template link with a UTC date range", () => {
    const url = googleCalendarUrl(EVENT);
    expect(url).toContain("https://calendar.google.com/calendar/render?");
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("dates=20260926T140000Z%2F20260926T180000Z");
    expect(url).toContain("text=NABIS+Summit%2C+NYC");
  });
});

describe("buildMonthGrid", () => {
  it("returns 42 cells (6 weeks)", () => {
    expect(buildMonthGrid(2026, 8)).toHaveLength(42);
  });
  it("starts on the Sunday on/before the 1st and flags in-month days", () => {
    // Sept 2026: the 1st is a Tuesday, so the grid starts Sun Aug 30.
    const grid = buildMonthGrid(2026, 8);
    expect(grid[0].key).toBe("2026-08-30");
    expect(grid[0].inMonth).toBe(false);
    const sept1 = grid.find((g) => g.key === "2026-09-01");
    expect(sept1?.inMonth).toBe(true);
  });
});
