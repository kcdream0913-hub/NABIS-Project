// Pure event helpers — enums that match the DB CHECK constraints, the wall-clock ⇄ UTC
// timezone mapping the editor round-trips, and draft validation. No React, no Supabase:
// everything here is unit-tested (lib/__tests__/events.test.ts).

export const EVENT_MODES = ["in_person", "online"] as const;
export type EventMode = (typeof EVENT_MODES)[number];

export const EVENT_VIEWS = ["us", "nepal", "bridge"] as const;
export type EventView = (typeof EVENT_VIEWS)[number];

// status matches the BL-EVENT-01 CHECK (scheduled | cancelled | postponed).
export const EVENT_STATUSES = ["scheduled", "cancelled", "postponed"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

// How far ahead of UTC `tz` is, in ms, at the instant `utcMs`. = (wall clock in tz) − utc.
// Uses formatToParts + Date.UTC (never Date.parse of a locale string) so it is engine- and
// locale-independent, and correct across DST and sub-hour zones (e.g. Asia/Kathmandu +5:45).
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let hour = g("hour");
  if (hour === 24) hour = 0; // some engines render midnight as "24"
  const wallAsUtc = Date.UTC(g("year"), g("month") - 1, g("day"), hour, g("minute"), g("second"));
  return wallAsUtc - utcMs;
}

/**
 * A zone-naive wall-clock datetime-local string ("YYYY-MM-DDTHH:mm") interpreted as a
 * local time in `tz` → the corresponding UTC instant as an ISO string. This is what the
 * editor stores in events.starts_at/ends_at: the host picks "6:00 PM" + a timezone, and we
 * persist the exact UTC instant that "6:00 PM in that zone" denotes.
 */
export function zonedWallToUtcIso(wall: string, tz: string): string {
  // Treat the wall string as if it were UTC (datetime-local is minutes-precision, so add
  // ":00" seconds when absent), then correct by the zone offset below.
  const withSeconds = /T\d{2}:\d{2}$/.test(wall) ? `${wall}:00` : wall;
  const naiveMs = Date.parse(`${withSeconds}Z`);
  if (Number.isNaN(naiveMs)) throw new Error(`invalid wall time: ${wall}`);
  // Subtract the zone offset; correct once more in case the offset differs at the target
  // instant (a DST boundary between the guess and the answer).
  let utcMs = naiveMs - tzOffsetMs(naiveMs, tz);
  utcMs = naiveMs - tzOffsetMs(utcMs, tz);
  return new Date(utcMs).toISOString();
}

/**
 * The inverse: a stored UTC instant (ISO) → the wall-clock datetime-local string as seen in
 * `tz`, for prefilling the editor in edit mode. Empty string for an unparseable input.
 */
export function utcIsoToZonedWall(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = g("hour");
  if (hour === "24") hour = "00";
  return `${g("year")}-${g("month")}-${g("day")}T${hour}:${g("minute")}`;
}

export type EventDraft = {
  title: string;
  view: string;
  startsAt: string; // datetime-local wall string
  endsAt: string; // datetime-local wall string (optional)
};

/**
 * Validate a draft. Returns an i18n key (under the `events` namespace) for the first
 * problem, or null when valid. `startsAt`/`endsAt` are wall strings in the SAME zone, so a
 * lexical compare of the fixed "YYYY-MM-DDTHH:mm" format is equivalent to comparing the
 * instants. ends_at > starts_at is enforced here client-side and flagged as a candidate DB
 * CHECK for the P1 migration.
 */
export function validateEvent(d: EventDraft): string | null {
  if (!d.title.trim()) return "errTitle";
  if (!EVENT_VIEWS.includes(d.view as EventView)) return "errView";
  if (!d.startsAt) return "errStarts";
  if (d.endsAt && !(d.endsAt > d.startsAt)) return "errEndsAfterStarts";
  return null;
}
