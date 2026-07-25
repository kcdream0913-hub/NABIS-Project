// Bounded place-name localization for the corridor. Person/business names are
// proper nouns and stay as written; only the small, known set of country and
// corridor-city labels get a Nepali rendering. Anything not in the map falls
// back to the stored Latin value (standard Nepali practice for US cities).

const COUNTRY_NE: Record<string, string> = {
  "united states": "अमेरिका",
  "usa": "अमेरिका",
  "us": "अमेरिका",
  "nepal": "नेपाल",
};

// Nepal corridor cities only. US cities intentionally omitted → Latin fallback.
const CITY_NE: Record<string, string> = {
  "kathmandu": "काठमाडौँ",
  "pokhara": "पोखरा",
  "lalitpur": "ललितपुर",
  "bhaktapur": "भक्तपुर",
  "biratnagar": "विराटनगर",
};

/** Localize a country label for the active locale; stored value elsewhere. */
export function localizeCountry(locale: string, value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (locale === "ne") return COUNTRY_NE[v.toLowerCase()] ?? v;
  return v;
}

/** Localize a corridor city for the active locale; stored value elsewhere. */
export function localizeCity(locale: string, value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (locale === "ne") return CITY_NE[v.toLowerCase()] ?? v;
  return v;
}
