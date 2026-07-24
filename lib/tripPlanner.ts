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
