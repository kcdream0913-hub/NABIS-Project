export type BodyLang = "en" | "ne";

// Majority-script heuristic for a post body's language. Used at post creation
// (composer) and mirrored exactly by the DB backfill in the
// posts_auto_translation migration, so the two never diverge. Counts Devanagari
// letters (U+0900–U+097F) against Latin letters; the majority wins. A mixed post
// (mostly English + one Nepali line) resolves to 'en' and is translated as a
// whole. Empty / emoji-only / digits-only resolves to 'en'.
export function detectBodyLang(text: string): BodyLang {
  const devanagari = (text.match(/[ऀ-ॿ]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return devanagari > latin ? "ne" : "en";
}
