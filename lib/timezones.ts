/**
 * Curated IANA timezone list for the timezone picker. The US–Nepal corridor is
 * grouped at the top (that's who this network serves); a compact set of common
 * world zones follows. Not exhaustive — the goal is a scannable picker, not the
 * full tz database.
 */
export type TimezoneGroup = { label: string; zones: string[] };

export const TIMEZONE_GROUPS: TimezoneGroup[] = [
  {
    label: "Nepal",
    zones: ["Asia/Kathmandu"],
  },
  {
    label: "United States",
    zones: [
      "America/New_York",
      "America/Chicago",
      "America/Denver",
      "America/Phoenix",
      "America/Los_Angeles",
      "America/Anchorage",
      "Pacific/Honolulu",
    ],
  },
  {
    label: "Other",
    zones: [
      "Europe/London",
      "Europe/Paris",
      "Europe/Berlin",
      "Asia/Dubai",
      "Asia/Kolkata",
      "Asia/Dhaka",
      "Asia/Bangkok",
      "Asia/Singapore",
      "Asia/Hong_Kong",
      "Asia/Shanghai",
      "Asia/Tokyo",
      "Australia/Sydney",
      "UTC",
    ],
  },
];

export const ALL_ZONES: string[] = TIMEZONE_GROUPS.flatMap((g) => g.zones);

/** Browser tz, falling back by country for the two corridor sides. */
export function defaultTimezone(country?: "us" | "nepal" | null): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) return tz;
  } catch {
    /* resolvedOptions unavailable — fall through to the country default */
  }
  return country === "nepal" ? "Asia/Kathmandu" : "America/New_York";
}

/** "America/New_York" -> "New York" for display. */
export function zoneLabel(zone: string): string {
  const city = zone.split("/").pop() ?? zone;
  return city.replace(/_/g, " ");
}
