// Single source of truth for sector slugs. Names and descriptions live in
// messages/{locale}.json under the "sectors" namespace so they translate —
// use the useSectors() hook below, not this array directly, to get display
// text. Matches the 12 channels seeded in Supabase (migration:
// replace_launch_sectors_with_refined_12).
export const SECTOR_SLUGS = [
  "technology-ai",
  "energy-hydropower",
  "investment-finance",
  "innovation-rd",
  "tourism-hospitality",
  "healthcare-life-sciences",
  "agriculture-food-systems",
  "infrastructure-logistics",
  "education-human-capital",
  "manufacturing-industry",
  "policy-immigration-legal",
  "media-creative-industries",
] as const;

export type SectorSlug = (typeof SECTOR_SLUGS)[number];
