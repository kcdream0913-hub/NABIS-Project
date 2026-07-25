// Generates docs/i18n/ne-review-BL-BIZ-02.md — a flat key · EN · NE(draft) table
// of every new Nepali string in BL-BIZ-02, so a native speaker (KC) can correct
// them in one pass (spec R11). Run: `node scripts/emit-ne-review.ts` (Node ≥ 22
// strips the type annotations) or `npx tsx scripts/emit-ne-review.ts`.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SERVICE_CATALOG, SECTOR_BIO_LABEL, CUSTOMER_CHIPS, YEARS_CHIPS, CROSSBORDER_CHIPS,
  BIO_SCAFFOLD, SECTOR_SLUGS,
} from "../app/[locale]/(app)/business/new/_lib/serviceCatalog.ts";

type Row = { key: string; en: string; ne: string };

const rows: Row[] = [];
for (const s of SECTOR_SLUGS) rows.push({ key: `sector.${s}`, en: SECTOR_BIO_LABEL[s].en, ne: SECTOR_BIO_LABEL[s].ne });
for (const s of SECTOR_SLUGS) for (const c of SERVICE_CATALOG[s]) rows.push({ key: `service.${s}.${c.id}`, en: c.en, ne: c.ne });
for (const c of CUSTOMER_CHIPS) rows.push({ key: `customer.${c.id}`, en: c.en, ne: c.ne });
for (const c of YEARS_CHIPS) rows.push({ key: `years.${c.id}`, en: c.en, ne: c.ne });
for (const c of CROSSBORDER_CHIPS) rows.push({ key: `crossborder.${c.id}`, en: c.en, ne: c.ne });

// Fixed sentence scaffolds (NE only has meaningful review value here).
rows.push({ key: "scaffold.ne.crossborder", en: BIO_SCAFFOLD.en.crossborder, ne: BIO_SCAFFOLD.ne.crossborder });
rows.push({ key: "scaffold.ne.sector-suffix", en: "…business in <place>, operating for <years>", ne: `<place>${BIO_SCAFFOLD.ne.s1Suffix} <sector> ${BIO_SCAFFOLD.ne.s1Sector}` });
rows.push({ key: "scaffold.ne.years", en: BIO_SCAFFOLD.en.s1Years, ne: `${BIO_SCAFFOLD.ne.s1Years} <years>${BIO_SCAFFOLD.ne.s1YearsSuffix}` });
rows.push({ key: "scaffold.ne.offer", en: `${BIO_SCAFFOLD.en.offer} <list>.`, ne: `${BIO_SCAFFOLD.ne.offer} <list> ${BIO_SCAFFOLD.ne.offerSuffix}${BIO_SCAFFOLD.ne.terminator}` });
rows.push({ key: "scaffold.ne.work", en: `${BIO_SCAFFOLD.en.work} <list>.`, ne: `${BIO_SCAFFOLD.ne.work} <list>${BIO_SCAFFOLD.ne.workSuffix}${BIO_SCAFFOLD.ne.terminator}` });

// Plus the new UI namespaces added in this batch, read from the bundles so the
// review list stays in sync with what actually ships.
import { readFileSync } from "node:fs";
const here = dirname(fileURLToPath(import.meta.url));
const en = JSON.parse(readFileSync(join(here, "..", "messages", "en.json"), "utf8"));
const ne = JSON.parse(readFileSync(join(here, "..", "messages", "ne.json"), "utf8"));
for (const nsName of ["guided", "businessEdit"] as const) {
  const enNs = en[nsName] ?? {};
  const neNs = ne[nsName] ?? {};
  for (const k of Object.keys(enNs)) {
    if (typeof enNs[k] === "string") rows.push({ key: `${nsName}.${k}`, en: enNs[k], ne: neNs[k] ?? "" });
  }
}
for (const k of ["plannedPriceTitle", "plannedPriceHint"]) {
  rows.push({ key: `businessNew.${k}`, en: en.businessNew?.[k] ?? "", ne: ne.businessNew?.[k] ?? "" });
}

// De-duplicate by NE value (the six generic sectors share one service list, so its
// six chips would otherwise repeat six times). Keep the first key seen.
const seen = new Set<string>();
const unique = rows.filter((r) => (seen.has(r.ne) ? false : (seen.add(r.ne), true)));

const esc = (s: string) => s.replace(/\|/g, "\\|");
const body = unique.map((r) => `| \`${r.key}\` | ${esc(r.en)} | ${esc(r.ne)} | |`).join("\n");

const md = `# Nepali review — BL-BIZ-02 (guided business onboarding)

**AI-drafted, unreviewed.** Every Nepali string introduced by BL-BIZ-02's guided
builder + deterministic bio assembler is listed below with its English source.
A native Nepali speaker should correct the NE column in one pass before this
reaches the pilot (spec R11 / D-001). The six generic sectors
(energy-hydropower, innovation-rd, investment-finance, media-creative-industries,
policy-immigration-legal, real-estate-home-improvement) share one generic service
list — its chips appear once here.

Rows: ${unique.length}

| key | EN (source) | NE (draft) | corrected NE |
|---|---|---|---|
${body}
`;

const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "i18n", "ne-review-BL-BIZ-02.md");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, md, "utf8");
console.log(`Wrote ${outPath} (${unique.length} rows)`);
