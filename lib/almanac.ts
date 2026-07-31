import { pickFestivalName, type Festival } from "./offerings";

/**
 * Festival countdown for the Nepali-calendar widget (BL-ENGAGE-01 #2). Reuses the
 * existing `festivals` table + `pickFestivalName` — no new data. A festival's
 * `dates` jsonb is keyed by AD year (`{ "2026": { start, end } }`); US-side slugs
 * carry an empty `dates` (month_hint only) and are skipped, since a month hint
 * alone can't drive a day countdown.
 */
export interface UpcomingFestival {
  slug: string;
  name: string; // localized for the active locale
  date: string; // ISO start date of the next occurrence
  daysUntil: number; // 0 = today
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * The next upcoming occurrence per festival — the soonest `start` on or after
 * today across every year present in `dates` — sorted soonest-first and limited.
 * Festivals with no dated window are omitted.
 */
export function upcomingFestivals(
  festivals: Festival[],
  today: Date,
  locale: string,
  limit = 4,
): UpcomingFestival[] {
  const t0 = startOfDay(today);
  const out: UpcomingFestival[] = [];
  for (const f of festivals) {
    let bestTs: number | null = null;
    let bestStart: string | null = null;
    for (const year of Object.keys(f.dates ?? {})) {
      const start = f.dates[year]?.start;
      if (!start) continue;
      const ts = startOfDay(new Date(`${start}T00:00:00`));
      if (Number.isNaN(ts) || ts < t0) continue;
      if (bestTs === null || ts < bestTs) {
        bestTs = ts;
        bestStart = start;
      }
    }
    if (bestTs === null || bestStart === null) continue;
    out.push({
      slug: f.slug,
      name: pickFestivalName(locale, f),
      date: bestStart,
      daysUntil: Math.round((bestTs - t0) / 86_400_000),
    });
  }
  out.sort((a, b) => a.daysUntil - b.daysUntil);
  return out.slice(0, limit);
}
