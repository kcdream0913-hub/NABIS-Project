// Deterministic, bilingual bio writer (BL-BIZ-02 §8). It concatenates pre-written
// label strings from serviceCatalog.ts — no model, no network, no number/date
// formatting (R5). EN and NE are parallel COMPOSITIONS from the same structured
// answers, not translations of each other, so no translation model is on the
// critical path. Sentences 2–5 are omitted whole when their input is empty — the
// output never contains a hole, a dangling comma, or an empty clause.

import {
  SERVICE_CATALOG, SECTOR_BIO_LABEL, CUSTOMER_CHIPS, YEARS_CHIPS, JOINERS, BIO_SCAFFOLD,
  chipLabel, type SectorSlug, type Locale,
} from "./serviceCatalog";
import type { Answers } from "./answers";
import { localizeCity } from "@/lib/localizePlace";

function joinList(items: string[], locale: Locale): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  const j = JOINERS[locale];
  return items.slice(0, -1).join(j.comma) + j.and + items[items.length - 1];
}

// The differentiator is the owner's own words, inserted verbatim; only guarantee a
// single terminator so the joined output stays clean.
function terminate(text: string, terminator: string): string {
  const t = text.trim();
  return /[.।!?]$/.test(t) ? t : t + terminator;
}

export function assembleBio(input: {
  name: string;
  city: string | null;
  primarySector: SectorSlug;
  answers: Answers;
  locale: Locale;
}): string {
  const { name, city, primarySector, answers, locale } = input;
  const catalog = SERVICE_CATALOG[primarySector] ?? [];

  const services = answers.services.map((id) => chipLabel(catalog, id, locale)).filter(Boolean);
  if (answers.extraServices?.trim()) services.push(answers.extraServices.trim());
  const customers = answers.customers.map((id) => chipLabel(CUSTOMER_CHIPS, id, locale)).filter(Boolean);
  const yearsPhrase = answers.years ? chipLabel(YEARS_CHIPS, answers.years, locale) : "";
  const sector = SECTOR_BIO_LABEL[primarySector][locale];
  const cityTrim = city?.trim() ?? "";
  const diff = answers.differentiator?.trim() ?? "";
  const includeDiff = (want: Locale) => !!diff && (answers.differentiatorLocale ?? "en") === want;

  const out: string[] = [];

  if (locale === "en") {
    const S = BIO_SCAFFOLD.en;
    const loc = cityTrim ? `${cityTrim}, Nepal` : "Nepal";
    let s1 = `${name} ${S.s1Prefix} ${sector} ${S.s1Sector} ${loc}`;
    if (yearsPhrase) s1 += `${S.s1Years} ${yearsPhrase}`;
    out.push(s1 + S.terminator);
    if (services.length) out.push(`${S.offer} ${joinList(services, "en")}${S.terminator}`);
    if (customers.length) out.push(`${S.work} ${joinList(customers, "en")}${S.terminator}`);
    if (includeDiff("en")) out.push(terminate(diff, S.terminator));
    if (answers.crossborder === "yes") out.push(S.crossborder);
  } else {
    const S = BIO_SCAFFOLD.ne;
    const cityNe = cityTrim ? localizeCity("ne", cityTrim) : "";
    const loc = cityNe ? `${cityNe}, नेपाल` : "नेपाल";
    let s1 = `${name} ${loc}${S.s1Suffix} ${sector} ${S.s1Sector}`;
    if (yearsPhrase) s1 += `${S.s1Years} ${yearsPhrase}${S.s1YearsSuffix}`;
    out.push(s1 + S.terminator);
    if (services.length) out.push(`${S.offer} ${joinList(services, "ne")} ${S.offerSuffix}${S.terminator}`);
    if (customers.length) out.push(`${S.work} ${joinList(customers, "ne")}${S.workSuffix}${S.terminator}`);
    if (includeDiff("ne")) out.push(terminate(diff, S.terminator));
    if (answers.crossborder === "yes") out.push(S.crossborder);
  }

  // Single spaces between sentences; guard against any accidental doubling.
  return out.join(" ").replace(/\s+/g, " ").trim();
}
