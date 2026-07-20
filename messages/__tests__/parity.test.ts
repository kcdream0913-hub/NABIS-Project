import { describe, it, expect } from "vitest";
import en from "../en.json";
import ne from "../ne.json";

// Flattens a nested message object into dotted keys, e.g. { nav: { feed: "x" } } -> ["nav.feed"]
function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k)
  );
}

// This is the single check that would have caught every "translated half the
// app, forgot the other half" mistake from this session before a build ever
// ran — en.json and ne.json must define exactly the same set of keys, or
// next-intl throws MISSING_MESSAGE at runtime for whichever key is missing.
describe("message bundle parity (en vs ne)", () => {
  const enKeys = new Set(flattenKeys(en));
  const neKeys = new Set(flattenKeys(ne));

  it("every English key has a Nepali counterpart", () => {
    const missing = [...enKeys].filter((k) => !neKeys.has(k));
    expect(missing).toEqual([]);
  });

  it("ne.json has no orphaned keys not present in en.json", () => {
    const extra = [...neKeys].filter((k) => !enKeys.has(k));
    expect(extra).toEqual([]);
  });

  it("no value in either bundle is an empty string (a common half-finished-translation mistake)", () => {
    const emptyEn = [...enKeys].filter((k) => k.split(".").reduce((o: any, p) => o?.[p], en) === "");
    const emptyNe = [...neKeys].filter((k) => k.split(".").reduce((o: any, p) => o?.[p], ne) === "");
    expect(emptyEn).toEqual([]);
    expect(emptyNe).toEqual([]);
  });

  it("has a substantial number of keys (guards against accidentally loading an empty/truncated file)", () => {
    expect(enKeys.size).toBeGreaterThan(200);
  });
});
