/**
 * Relative + absolute timestamp formatting for the feed.
 *
 * `formatRelativeTime` renders a compact, locale-aware "2h" / "3d" / "just now"
 * label via Intl.RelativeTimeFormat; `formatAbsoluteTime` renders the full
 * date-time shown on hover (the `title`). Both are pure and browser-safe
 * (client components only — they read the current wall clock).
 */

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

export function formatRelativeTime(iso: string, locale = "en"): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
  let duration = (then - Date.now()) / 1000; // seconds, negative for the past
  for (const { amount, unit } of DIVISIONS) {
    if (Math.abs(duration) < amount) {
      return rtf.format(Math.round(duration), unit);
    }
    duration /= amount;
  }
  return "";
}

export function formatAbsoluteTime(iso: string, locale = "en"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
