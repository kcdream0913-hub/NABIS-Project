// Calendar export for events — no OAuth. `buildIcs` produces a downloadable
// .ics; `googleCalendarUrl` builds a prefilled Google Calendar "create event"
// link. Both are pure so they're unit-tested without a browser.

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string | null; // ISO instant
  endsAt?: string | null; // ISO instant
  durationMinutes?: number; // used when endsAt is absent (default 60)
}

// ICS/Google want UTC basic format: YYYYMMDDTHHMMSSZ.
function toIcsUtc(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

function endInstant(e: CalendarEvent): string | null {
  if (e.endsAt) return e.endsAt;
  if (!e.startsAt) return null;
  const mins = e.durationMinutes ?? 60;
  return new Date(new Date(e.startsAt).getTime() + mins * 60_000).toISOString();
}

// ICS text needs CRLF line endings and escaped commas/semicolons/newlines.
function escapeIcs(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** A minimal, valid single-event VCALENDAR string (CRLF-delimited). */
export function buildIcs(e: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BridgeLink//Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.id}@bridgelink`,
    `SUMMARY:${escapeIcs(e.title)}`,
  ];
  if (e.startsAt) lines.push(`DTSTART:${toIcsUtc(e.startsAt)}`);
  const end = endInstant(e);
  if (end) lines.push(`DTEND:${toIcsUtc(end)}`);
  if (e.location) lines.push(`LOCATION:${escapeIcs(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${escapeIcs(e.description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export interface GridDay {
  y: number;
  m: number; // 0-indexed month
  d: number;
  key: string; // YYYY-MM-DD
  inMonth: boolean;
}

/**
 * A 6-row month grid (Sunday-first) covering `monthIndex` of `year`, padded with
 * the trailing/leading days of the adjacent months so every row has 7 cells.
 */
export function buildMonthGrid(year: number, monthIndex: number): GridDay[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay()); // back up to the Sunday
  const days: GridDay[] = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(start);
    dt.setUTCDate(start.getUTCDate() + i);
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth();
    const d = dt.getUTCDate();
    const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({ y, m, d, key, inMonth: m === monthIndex });
  }
  return days;
}

/** Prefilled Google Calendar template link (no OAuth, opens in a new tab). */
export function googleCalendarUrl(e: CalendarEvent): string {
  const params = new URLSearchParams({ action: "TEMPLATE", text: e.title });
  if (e.startsAt) {
    const end = endInstant(e) ?? e.startsAt;
    params.set("dates", `${toIcsUtc(e.startsAt)}/${toIcsUtc(end)}`);
  }
  if (e.description) params.set("details", e.description);
  if (e.location) params.set("location", e.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
