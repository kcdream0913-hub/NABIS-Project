// Trip Planner v2 — Commit C1 matching logic. Pure + testable; no React here.
// Filters PUBLISHED offerings against a trip's direction / destination / dates and
// softly ranks by interest. Category mapping seeds the day-by-day builder.
import type { DirectionTag, Offering, OfferingCountry, OfferingType } from "./offerings";
import type { RecommendationCategory } from "./tripPlannerData";

export const DIRECTIONS: DirectionTag[] = [
  "np_to_us",
  "us_to_np",
  "domestic_np",
  "domestic_us",
  "other",
];

// origin/destination as ISO-3166 alpha-2 (uppercase), for the fixed directions.
export function directionEndpoints(
  direction: DirectionTag | "",
): { origin: string | null; destination: string | null } {
  switch (direction) {
    case "np_to_us": return { origin: "NP", destination: "US" };
    case "us_to_np": return { origin: "US", destination: "NP" };
    case "domestic_np": return { origin: "NP", destination: "NP" };
    case "domestic_us": return { origin: "US", destination: "US" };
    default: return { origin: null, destination: null };
  }
}

// The corridor side an offering's `country` ('np'|'us') is filtered against.
export function destinationCountryFor(
  direction: DirectionTag | "",
  otherDestinationISO?: string | null,
): OfferingCountry | null {
  const fixed = directionEndpoints(direction).destination;
  const iso = (direction === "other" ? otherDestinationISO : fixed) ?? "";
  const up = iso.toUpperCase();
  return up === "NP" ? "np" : up === "US" ? "us" : null;
}

export function offeringTypeToCategory(type: OfferingType): RecommendationCategory {
  switch (type) {
    case "stay": return "stay";
    case "transport": return "transport";
    case "food_experience": return "food";
    case "trek":
    case "tour":
    case "guide_service":
    case "wellness":
    case "festival_package":
    case "event_package":
      return "activity";
    default: return "other";
  }
}

// Loose interest → offering-type hints (used to rank, never to exclude).
export const INTEREST_TYPE_HINTS: Record<string, OfferingType[]> = {
  "trekking-outdoors": ["trek", "guide_service"],
  "culture-heritage": ["tour", "festival_package", "guide_service"],
  "food-culinary": ["food_experience"],
  "wildlife-nature": ["tour", "trek"],
  "wellness-retreat": ["wellness", "stay"],
  "business-networking": ["event_package"],
  "shopping-crafts": ["tour"],
  "festivals-events": ["festival_package", "event_package"],
};

// Inclusive overlap; null bounds are open-ended. ISO date strings compare lexically.
export function rangesOverlap(
  aStart: string | null,
  aEnd: string | null,
  bStart: string | null,
  bEnd: string | null,
): boolean {
  if (aEnd && bStart && aEnd < bStart) return false;
  if (bEnd && aStart && bEnd < aStart) return false;
  return true;
}

export interface TripFilter {
  direction: DirectionTag | "";
  destinationCountry: OfferingCountry | null;
  startDate: string;
  endDate: string;
}

export function offeringMatchesTrip(o: Offering, trip: TripFilter): boolean {
  // direction: empty tags = shown for any direction; otherwise must include it.
  if (trip.direction && o.direction_tags.length > 0 && !o.direction_tags.includes(trip.direction)) {
    return false;
  }
  // country: only excludes when both the offering and the destination side are known.
  if (trip.destinationCountry && o.country && o.country !== trip.destinationCountry) {
    return false;
  }
  // dates: only filters when the offering carries an availability window and the
  // trip carries dates — otherwise the offering stays eligible.
  if ((o.available_from || o.available_to) && (trip.startDate || trip.endDate)) {
    if (!rangesOverlap(trip.startDate || null, trip.endDate || null, o.available_from, o.available_to)) {
      return false;
    }
  }
  return true;
}

export function interestScore(o: Offering, interests: string[]): number {
  if (interests.length === 0) return 0;
  const types = new Set(interests.flatMap((i) => INTEREST_TYPE_HINTS[i] ?? []));
  return types.has(o.type) ? 1 : 0;
}

/** Hard-filter by direction/country/date, then rank interest-matches first. */
export function matchOfferings(offerings: Offering[], trip: TripFilter, interests: string[]): Offering[] {
  return offerings
    .filter((o) => offeringMatchesTrip(o, trip))
    .sort((a, b) => interestScore(b, interests) - interestScore(a, interests));
}

// ── Festival overlap (Step 2 overlay) ─────────────────────────────────────────
import type { Festival } from "./offerings";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Month numbers (1–12) the trip spans; empty when there are no dates. */
export function monthsInRange(startDate: string, endDate: string): number[] {
  const s = startDate || endDate;
  const e = endDate || startDate;
  if (!s || !e) return [];
  const sd = new Date(s), ed = new Date(e);
  if (isNaN(sd.getTime()) || isNaN(ed.getTime())) return [];
  const out = new Set<number>();
  let y = sd.getUTCFullYear(), m = sd.getUTCMonth();
  const ey = ed.getUTCFullYear(), em = ed.getUTCMonth();
  for (let i = 0; i < 14 && (y < ey || (y === ey && m <= em)); i++) {
    out.add(m + 1);
    m++; if (m > 11) { m = 0; y++; }
  }
  return [...out];
}

/** Month numbers named in a free-text hint like "October–November". */
export function monthsFromHint(hint: string | null | undefined): number[] {
  if (!hint) return [];
  const low = hint.toLowerCase();
  return MONTHS.map((name, i) => (low.includes(name) ? i + 1 : 0)).filter(Boolean);
}

// null = no overlap; {start,end} = dated overlap; "month" = month_hint fallback.
export type FestivalOverlap = { start: string; end: string } | "month" | null;

export function festivalOverlap(f: Festival, startDate: string, endDate: string): FestivalOverlap {
  const s = startDate || endDate;
  const e = endDate || startDate;
  if (!s || !e) return null; // no trip dates → nothing to overlap
  const sy = new Date(s).getUTCFullYear();
  const ey = new Date(e).getUTCFullYear();
  for (let y = sy; y <= ey && y - sy < 3; y++) {
    const w = f.dates?.[String(y)];
    if (w?.start && w?.end && rangesOverlap(s, e, w.start, w.end)) {
      return { start: w.start, end: w.end };
    }
  }
  // fall back to month_hint only when no dated window matched
  const tripMonths = monthsInRange(startDate, endDate);
  if (monthsFromHint(f.month_hint).some((m) => tripMonths.includes(m))) return "month";
  return null;
}

export function festivalsOverlappingRange(
  festivals: Festival[],
  startDate: string,
  endDate: string,
): { festival: Festival; overlap: FestivalOverlap }[] {
  return festivals
    .map((festival) => ({ festival, overlap: festivalOverlap(festival, startDate, endDate) }))
    .filter((x) => x.overlap !== null);
}

// Nepal-bound trips overlapping these get a peak-season advisory.
export const PEAK_FESTIVALS = ["dashain", "tihar"];

// ── Step 3 filter row ─────────────────────────────────────────────────────────
export interface OfferingFilters {
  type: string;
  season: string;
  festival: string;
  priceMin: string;
  priceMax: string;
}

export function applyOfferingFilters(offerings: Offering[], f: OfferingFilters): Offering[] {
  const min = f.priceMin.trim() === "" ? null : Number(f.priceMin);
  const max = f.priceMax.trim() === "" ? null : Number(f.priceMax);
  return offerings.filter((o) => {
    if (f.type && o.type !== f.type) return false;
    if (f.season && !o.seasons.includes(f.season)) return false;
    if (f.festival && !o.festival_slugs.includes(f.festival)) return false;
    if (min != null && (o.price_from == null || o.price_from < min)) return false;
    if (max != null && o.price_from != null && o.price_from > max) return false;
    return true;
  });
}

// Curated ISO-3166 alpha-2 list for the "Other" direction selects (corridor +
// common travel destinations — a scannable picker, not the full set).
export const ISO_COUNTRIES: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "NP", name: "Nepal" },
  { code: "IN", name: "India" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "QA", name: "Qatar" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "CH", name: "Switzerland" },
  { code: "IE", name: "Ireland" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "HK", name: "Hong Kong" },
  { code: "SG", name: "Singapore" },
  { code: "TH", name: "Thailand" },
  { code: "MY", name: "Malaysia" },
  { code: "BD", name: "Bangladesh" },
  { code: "LK", name: "Sri Lanka" },
  { code: "BT", name: "Bhutan" },
  { code: "PK", name: "Pakistan" },
  { code: "MX", name: "Mexico" },
  { code: "BR", name: "Brazil" },
  { code: "ZA", name: "South Africa" },
  { code: "KE", name: "Kenya" },
  { code: "NG", name: "Nigeria" },
  { code: "NZ", name: "New Zealand" },
  { code: "TR", name: "Türkiye" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
];
