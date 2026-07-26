import type { BodyLang } from "./detectLang";

// Pure display-decision for a post body under auto-translation. Kept out of the
// component so the "when do we show the translation / the tag / the toggle"
// logic is unit-testable. There are only two locales, so a post's single cached
// translation (body_translated) is always the opposite of body_lang — i.e. the
// viewer's locale whenever a translation is needed.
export interface PostDisplayInput {
  body: string;
  bodyLang: BodyLang;
  viewerLocale: string; // "en" | "ne" (any string tolerated)
  translation: string | null; // cached or freshly-fetched translation, else null
  showOriginal: boolean; // the See-original toggle
}

export interface PostDisplay {
  text: string; // what to render
  needsTranslation: boolean; // viewer reads the other language
  isTranslated: boolean; // currently showing the translation → show the tag
  canToggle: boolean; // a translation exists → show See-original / Show-translation
  showingOriginal: boolean; // toggled back to the source
}

export function resolvePostDisplay(input: PostDisplayInput): PostDisplay {
  const viewerIsKnown = input.viewerLocale === "en" || input.viewerLocale === "ne";
  const needsTranslation = viewerIsKnown && input.viewerLocale !== input.bodyLang;
  const hasTranslation = needsTranslation && !!input.translation;
  const isTranslated = hasTranslation && !input.showOriginal;
  return {
    text: isTranslated ? (input.translation as string) : input.body,
    needsTranslation,
    isTranslated,
    canToggle: hasTranslation,
    showingOriginal: hasTranslation && input.showOriginal,
  };
}
