import type { BodyLang } from "./detectLang";

// Server-side translation behind a small, env-swappable interface. The default
// provider calls the Anthropic API (a Claude Haiku model) with a strict
// translate-only prompt. Only ever imported by the /api/posts/translate route —
// never client code (it reads server-only env like ANTHROPIC_API_KEY).

export interface TranslationProvider {
  translate(text: string, from: BodyLang, to: BodyLang): Promise<string>;
}

const LANG_NAME: Record<BodyLang, string> = { en: "English", ne: "Nepali" };

// Strict, addition-free prompt. Kept pure + exported so it can be unit-tested.
export function buildTranslatePrompt(text: string, from: BodyLang, to: BodyLang): string {
  return [
    `Translate the text below from ${LANG_NAME[from]} to ${LANG_NAME[to]}.`,
    `Output ONLY the translation — no preamble, no quotes, no notes, no explanation.`,
    `Preserve names, numbers, URLs, @mentions, #hashtags, emoji, and line breaks exactly as they appear.`,
    `Do not add, remove, summarize, or comment on anything. Translate the whole text as one unit.`,
    ``,
    text,
  ].join("\n");
}

class AnthropicProvider implements TranslationProvider {
  constructor(
    private apiKey: string,
    private model: string,
  ) {}

  async translate(text: string, from: BodyLang, to: BodyLang): Promise<string> {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2048,
        messages: [{ role: "user", content: buildTranslatePrompt(text, from, to) }],
      }),
    });
    if (!res.ok) {
      throw new Error(`Anthropic translate failed: ${res.status} ${await res.text().catch(() => "")}`);
    }
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const out = (data.content?.find((b) => b.type === "text")?.text ?? "").trim();
    if (!out) throw new Error("Anthropic translate returned empty text");
    return out;
  }
}

// Deterministic, offline provider for local verification / CI (no API key). Not
// a real translation — it prefixes a Devanagari/Latin marker so the full
// pipeline (detect → fetch → cache → tag → toggle) is exercisable end-to-end.
class MockProvider implements TranslationProvider {
  async translate(text: string, _from: BodyLang, to: BodyLang): Promise<string> {
    return to === "ne" ? `अनुवाद: ${text}` : `Translation: ${text}`;
  }
}

export function getTranslationProvider(): TranslationProvider {
  const kind = (process.env.TRANSLATION_PROVIDER || "anthropic").toLowerCase();
  if (kind === "mock") return new MockProvider();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = process.env.ANTHROPIC_TRANSLATION_MODEL || "claude-haiku-4-5-20251001";
  return new AnthropicProvider(apiKey, model);
}
