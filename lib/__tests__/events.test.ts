import { describe, it, expect } from "vitest";
import {
  zonedWallToUtcIso,
  utcIsoToZonedWall,
  validateEvent,
  EVENT_MODES,
  EVENT_VIEWS,
  EVENT_STATUSES,
} from "../events";

describe("event enums match the DB CHECK constraints", () => {
  it("mode / view / status vocabularies", () => {
    expect(EVENT_MODES).toEqual(["in_person", "online"]);
    expect(EVENT_VIEWS).toEqual(["us", "nepal", "bridge"]);
    expect(EVENT_STATUSES).toEqual(["scheduled", "cancelled", "postponed"]);
  });
});

describe("zonedWallToUtcIso — wall clock in a zone → UTC instant", () => {
  it("America/New_York in September is EDT (UTC-4)", () => {
    // 6:00 PM EDT = 22:00 UTC
    expect(zonedWallToUtcIso("2026-09-26T18:00", "America/New_York")).toBe("2026-09-26T22:00:00.000Z");
  });

  it("America/New_York in January is EST (UTC-5) — DST handled", () => {
    // 6:00 PM EST = 23:00 UTC (the offset differs from the September case)
    expect(zonedWallToUtcIso("2026-01-15T18:00", "America/New_York")).toBe("2026-01-15T23:00:00.000Z");
  });

  it("Asia/Kathmandu is UTC+5:45 — sub-hour offset", () => {
    // 6:00 PM NPT − 5:45 = 12:15 UTC
    expect(zonedWallToUtcIso("2026-09-26T18:00", "Asia/Kathmandu")).toBe("2026-09-26T12:15:00.000Z");
  });

  it("UTC is identity", () => {
    expect(zonedWallToUtcIso("2026-09-26T18:00", "UTC")).toBe("2026-09-26T18:00:00.000Z");
  });

  it("throws on an unparseable wall string", () => {
    expect(() => zonedWallToUtcIso("not-a-date", "UTC")).toThrow();
  });
});

describe("utcIsoToZonedWall — UTC instant → wall clock in a zone", () => {
  it("renders a UTC instant as the local wall time", () => {
    expect(utcIsoToZonedWall("2026-09-26T22:00:00.000Z", "America/New_York")).toBe("2026-09-26T18:00");
    expect(utcIsoToZonedWall("2026-09-26T12:15:00.000Z", "Asia/Kathmandu")).toBe("2026-09-26T18:00");
  });

  it("returns empty for null/empty/invalid", () => {
    expect(utcIsoToZonedWall(null, "UTC")).toBe("");
    expect(utcIsoToZonedWall("", "UTC")).toBe("");
    expect(utcIsoToZonedWall("garbage", "UTC")).toBe("");
  });

  it("round-trips wall → utc → wall for several zones", () => {
    for (const tz of ["America/New_York", "Asia/Kathmandu", "Europe/London", "UTC"]) {
      const wall = "2026-07-04T09:30";
      expect(utcIsoToZonedWall(zonedWallToUtcIso(wall, tz), tz)).toBe(wall);
    }
  });
});

describe("validateEvent", () => {
  const ok = { title: "Kickoff", view: "us", startsAt: "2026-09-26T18:00", endsAt: "2026-09-26T20:00" };

  it("passes a complete valid draft", () => {
    expect(validateEvent(ok)).toBeNull();
  });
  it("requires a title", () => {
    expect(validateEvent({ ...ok, title: "   " })).toBe("errTitle");
  });
  it("requires a valid view", () => {
    expect(validateEvent({ ...ok, view: "" })).toBe("errView");
    expect(validateEvent({ ...ok, view: "moon" })).toBe("errView");
  });
  it("requires a start", () => {
    expect(validateEvent({ ...ok, startsAt: "" })).toBe("errStarts");
  });
  it("rejects end <= start", () => {
    expect(validateEvent({ ...ok, endsAt: "2026-09-26T18:00" })).toBe("errEndsAfterStarts");
    expect(validateEvent({ ...ok, endsAt: "2026-09-26T17:00" })).toBe("errEndsAfterStarts");
  });
  it("allows an omitted end", () => {
    expect(validateEvent({ ...ok, endsAt: "" })).toBeNull();
  });
});
