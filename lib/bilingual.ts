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
