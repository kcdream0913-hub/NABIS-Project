import { describe, it, expect } from "vitest";
import { resolvePostDisplay } from "../postTranslation";

const EN = "Hello corridor";
const NE = "नमस्ते कोरिडोर";

describe("resolvePostDisplay", () => {
  it("shows the original untouched when the viewer reads the post's language", () => {
    const d = resolvePostDisplay({ body: EN, bodyLang: "en", viewerLocale: "en", translation: null, showOriginal: false });
    expect(d.needsTranslation).toBe(false);
    expect(d.text).toBe(EN);
    expect(d.isTranslated).toBe(false);
    expect(d.canToggle).toBe(false);
  });

  it("shows the original immediately when translation is not ready (non-blocking)", () => {
    const d = resolvePostDisplay({ body: EN, bodyLang: "en", viewerLocale: "ne", translation: null, showOriginal: false });
    expect(d.needsTranslation).toBe(true); // triggers the fetch
    expect(d.text).toBe(EN); // but never blocks — original shows
    expect(d.isTranslated).toBe(false);
    expect(d.canToggle).toBe(false);
  });

  it("shows the translation + tag + toggle once available", () => {
    const d = resolvePostDisplay({ body: EN, bodyLang: "en", viewerLocale: "ne", translation: NE, showOriginal: false });
    expect(d.text).toBe(NE);
    expect(d.isTranslated).toBe(true); // → render the Auto-translated tag
    expect(d.canToggle).toBe(true); // → render See original
    expect(d.showingOriginal).toBe(false);
  });

  it("See-original toggles back to the source, keeping the toggle", () => {
    const d = resolvePostDisplay({ body: EN, bodyLang: "en", viewerLocale: "ne", translation: NE, showOriginal: true });
    expect(d.text).toBe(EN);
    expect(d.isTranslated).toBe(false); // no tag while showing original
    expect(d.canToggle).toBe(true); // → render Show translation
    expect(d.showingOriginal).toBe(true);
  });

  it("mirror direction: NE post viewed in EN", () => {
    const d = resolvePostDisplay({ body: NE, bodyLang: "ne", viewerLocale: "en", translation: EN, showOriginal: false });
    expect(d.needsTranslation).toBe(true);
    expect(d.text).toBe(EN);
    expect(d.isTranslated).toBe(true);
  });

  it("ignores unknown viewer locales", () => {
    const d = resolvePostDisplay({ body: EN, bodyLang: "en", viewerLocale: "fr", translation: NE, showOriginal: false });
    expect(d.needsTranslation).toBe(false);
    expect(d.text).toBe(EN);
  });
});
