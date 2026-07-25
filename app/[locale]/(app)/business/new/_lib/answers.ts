// profile_answers shape + validation. Hand-rolled rather than zod: zod is not a
// project dependency and the stack is locked (CLAUDE.md) — a dependency add is a
// Breakthrough, not an incidental. This covers what the spec's zod schema needed:
// a typed round-trip and a length guard (BL-BIZ-02 §8, test §12.8).

export type Crossborder = "yes" | "no" | "unsure";
export type AnswerLocale = "en" | "ne";

export interface Answers {
  services: string[]; // chip ids
  customers: string[]; // chip ids
  years: string | null; // chip id
  differentiator: string | null; // free text, owner's own words
  differentiatorLocale: AnswerLocale | null; // which language sentence 4 belongs to
  crossborder: Crossborder | null;
  extraServices: string | null; // "something else" free text
}

export const EMPTY_ANSWERS: Answers = {
  services: [],
  customers: [],
  years: null,
  differentiator: null,
  differentiatorLocale: null,
  crossborder: null,
  extraServices: null,
};

const CROSSBORDER = new Set<Crossborder>(["yes", "no", "unsure"]);
const LOCALES = new Set<AnswerLocale>(["en", "ne"]);

function strArray(v: unknown, field: string, max: number): string[] {
  if (!Array.isArray(v)) throw new Error(`${field} must be an array`);
  if (v.length > max) throw new Error(`${field} has ${v.length} items, max ${max}`);
  return v.map((x) => {
    if (typeof x !== "string" || !x.trim()) throw new Error(`${field} must be non-empty strings`);
    return x;
  });
}

function nullableStr(v: unknown, field: string): string | null {
  if (v == null) return null;
  if (typeof v !== "string") throw new Error(`${field} must be a string or null`);
  const t = v.trim();
  return t === "" ? null : t;
}

/**
 * Validate an arbitrary blob into Answers. `maxServices`/`maxCustomers` bound the
 * chip arrays (pass the catalog length; the "something else" text is separate).
 * Throws on invalid input.
 */
export function parseAnswers(
  raw: unknown,
  opts: { maxServices?: number; maxCustomers?: number } = {},
): Answers {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const maxServices = opts.maxServices ?? 64;
  const maxCustomers = opts.maxCustomers ?? 64;

  const crossborder = o.crossborder == null ? null : String(o.crossborder);
  if (crossborder !== null && !CROSSBORDER.has(crossborder as Crossborder)) {
    throw new Error(`crossborder must be one of yes|no|unsure`);
  }
  const differentiatorLocale = o.differentiatorLocale == null ? null : String(o.differentiatorLocale);
  if (differentiatorLocale !== null && !LOCALES.has(differentiatorLocale as AnswerLocale)) {
    throw new Error(`differentiatorLocale must be en|ne`);
  }

  return {
    services: strArray(o.services ?? [], "services", maxServices),
    customers: strArray(o.customers ?? [], "customers", maxCustomers),
    years: nullableStr(o.years, "years"),
    differentiator: nullableStr(o.differentiator, "differentiator"),
    differentiatorLocale: differentiatorLocale as AnswerLocale | null,
    crossborder: crossborder as Crossborder | null,
    extraServices: nullableStr(o.extraServices, "extraServices"),
  };
}

/** Non-throwing variant. */
export function safeParseAnswers(
  raw: unknown,
  opts?: { maxServices?: number; maxCustomers?: number },
): { success: true; data: Answers } | { success: false; error: string } {
  try {
    return { success: true, data: parseAnswers(raw, opts) };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "invalid answers" };
  }
}
