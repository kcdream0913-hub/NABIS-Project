import { describe, it, expect } from "vitest";
import { detectBodyLang } from "../detectLang";

describe("detectBodyLang (majority-script heuristic)", () => {
  it("classifies pure English as en", () => {
    expect(detectBodyLang("Just wrapped a call with two Kathmandu AI startups.")).toBe("en");
  });

  it("classifies pure Nepali (Devanagari) as ne", () => {
    expect(detectBodyLang("नयाँ संग्रह: तिहारका लागि हस्तनिर्मित ढाका उपहार सेटहरू")).toBe("ne");
  });

  it("classifies a mixed post with an English majority as en (translated whole)", () => {
    // The Dashain-style post: English body + one Nepali line → majority English.
    expect(detectBodyLang("Dashain 2026 departures are live! Book the Annapurna circuit now. शुभ दशैं!")).toBe("en");
  });

  it("classifies a mixed post with a Nepali majority as ne", () => {
    expect(detectBodyLang("काठमाडौंमा पर्यटन प्रवर्द्धन भिडियोका लागि पार्टनर चाहियो — DM me")).toBe("ne");
  });

  it("defaults empty / non-letter content to en", () => {
    expect(detectBodyLang("")).toBe("en");
    expect(detectBodyLang("12345 !!! https://x.com 🎉")).toBe("en");
  });
});
