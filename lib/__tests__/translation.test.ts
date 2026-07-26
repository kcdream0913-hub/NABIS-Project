import { describe, it, expect } from "vitest";
import { buildTranslatePrompt, getTranslationProvider } from "../translation";

describe("buildTranslatePrompt", () => {
  it("names the direction and embeds the exact text", () => {
    const p = buildTranslatePrompt("Book the Annapurna circuit", "en", "ne");
    expect(p).toContain("from English to Nepali");
    expect(p).toContain("Book the Annapurna circuit");
  });

  it("is strict: translate-only, no additions, preserve entities", () => {
    const p = buildTranslatePrompt("x", "ne", "en");
    expect(p).toContain("from Nepali to English");
    expect(p).toMatch(/Output ONLY the translation/i);
    expect(p).toMatch(/Preserve names, numbers, URLs/i);
    expect(p).toMatch(/Do not add, remove/i);
  });
});

describe("getTranslationProvider (mock)", () => {
  it("mock provider produces Devanagari for en→ne so the pipeline is exercisable offline", async () => {
    const prev = process.env.TRANSLATION_PROVIDER;
    process.env.TRANSLATION_PROVIDER = "mock";
    try {
      const out = await getTranslationProvider().translate("Hello", "en", "ne");
      expect(out).toMatch(/[ऀ-ॿ]/); // contains Devanagari
      expect(out).toContain("Hello");
    } finally {
      process.env.TRANSLATION_PROVIDER = prev;
    }
  });
});
