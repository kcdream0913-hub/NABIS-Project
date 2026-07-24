/**
 * Bilingual bio selection. bio = English, bio_ne = Nepali (both optional). Show
 * the active locale's version; if it's empty, fall back to the other and mark
 * its origin so the reader knows it isn't in their language. Returns null when
 * neither is present.
 */
export type BioOrigin = "en" | "ne" | null;

export function pickBio(
  locale: string,
  bio?: string | null,
  bioNe?: string | null,
): { text: string; origin: BioOrigin } | null {
  const en = bio?.trim() || null;
  const ne = bioNe?.trim() || null;
  if (locale === "ne") {
    if (ne) return { text: ne, origin: null };
    if (en) return { text: en, origin: "en" };
  } else {
    if (en) return { text: en, origin: null };
    if (ne) return { text: ne, origin: "ne" };
  }
  return null;
}

/**
 * True when the shown bio is the auto-translated Nepali draft displayed as the
 * active-locale text (locale === "ne", the ne bio shown directly, and the owner
 * hasn't reviewed it yet). This is distinct from the fallback "(English)" marker.
 */
export function isAutoBio(
  locale: string,
  pick: { origin: BioOrigin } | null,
  bioNeAuto?: boolean | null,
): boolean {
  return !!bioNeAuto && !!pick && pick.origin === null && locale === "ne";
}
