// Single source of truth for sector/channel names. "What describes you" on the
// profile and the channel list in Messages both read from this — so they can
// never drift apart. Matches the slugs seeded in supabase/schema.sql.
export const SECTORS = [
  { slug: "investment-policy", name: "Investment & Policy" },
  { slug: "logistics-supply-chain", name: "Logistics & Supply Chain" },
  { slug: "tourism-hospitality", name: "Tourism & Hospitality" },
  { slug: "tech-ai", name: "Tech & AI" },
  { slug: "immigration-legal", name: "Immigration & Legal" },
  { slug: "media-journalism", name: "Media & Journalism" },
  { slug: "entrepreneurs", name: "Entrepreneurs" },
  { slug: "freelancers-outsourcing", name: "Freelancers / Outsourcing" },
] as const;

export type SectorSlug = (typeof SECTORS)[number]["slug"];

export function sectorName(slug: string): string {
  return SECTORS.find((s) => s.slug === slug)?.name ?? slug;
}
