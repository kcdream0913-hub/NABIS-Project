// Trip Planner v2 — offerings domain (Commit B). Slugs live here; their labels
// translate via the "offerings" namespace in messages/{locale}.json. Mirrors the
// DB: table public.offerings (migration 20260724173650_trip_planner_v2).
//
// UI ships tourism-hospitality only (D-019); the schema supports every sector, so
// `sector` is stored but not surfaced as a picker in this commit.

export type OfferingOwnerType = "business" | "profile";
export type OfferingStatus = "draft" | "published" | "archived";
export type OfferingType =
  | "trek" | "tour" | "stay" | "food_experience" | "transport"
  | "festival_package" | "guide_service" | "wellness" | "event_package";
export type DirectionTag = "np_to_us" | "us_to_np" | "domestic_np" | "domestic_us" | "other";
export type PriceUnit = "per_person" | "per_group" | "per_night";
export type OfferingCountry = "np" | "us";

export const OFFERING_TYPES: OfferingType[] = [
  "trek", "tour", "stay", "food_experience", "transport",
  "festival_package", "guide_service", "wellness", "event_package",
];
export const DIRECTION_TAGS: DirectionTag[] = [
  "np_to_us", "us_to_np", "domestic_np", "domestic_us", "other",
];
export const PRICE_UNITS: PriceUnit[] = ["per_person", "per_group", "per_night"];
export const OFFERING_CURRENCIES = ["USD", "NPR"] as const;
export const SEASONS = ["spring", "summer", "monsoon", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export const TOURISM_SECTOR = "tourism-hospitality";

export interface Offering {
  id: string;
  owner_type: OfferingOwnerType;
  business_id: string | null;
  profile_id: string | null;
  sector: string;
  type: OfferingType;
  title: string;
  title_ne: string | null;
  description: string | null;
  description_ne: string | null;
  country: OfferingCountry | null;
  region: string | null;
  direction_tags: DirectionTag[];
  price_from: number | null;
  price_currency: string;
  price_unit: PriceUnit;
  duration_days: number | null;
  group_min: number | null;
  group_max: number | null;
  seasons: string[];
  festival_slugs: string[];
  available_from: string | null;
  available_to: string | null;
  media: unknown[];
  status: OfferingStatus;
  created_at: string;
  updated_at: string;
}

export interface Festival {
  slug: string;
  name: string;
  name_ne: string | null;
  country: OfferingCountry | null;
  month_hint: string | null;
  dates: Record<string, { start?: string; end?: string }>;
}

/** A subject can publish offerings only if it operates in tourism-hospitality. */
export function canPublishOfferings(
  sectors: (string | null | undefined)[] | null | undefined,
): boolean {
  return Array.isArray(sectors) && sectors.filter(Boolean).includes(TOURISM_SECTOR);
}

/** Localized festival name for the active locale, falling back to English. */
export function pickFestivalName(locale: string, f: Festival): string {
  if (locale === "ne" && f.name_ne?.trim()) return f.name_ne;
  return f.name;
}

/** "$1,200" / "NPR 1,200" — null when there's no price. */
export function formatMoney(amount: number | null | undefined, currency: string): string | null {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}
