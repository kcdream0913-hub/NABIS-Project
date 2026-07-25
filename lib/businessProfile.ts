// Shared shape for the business registration/edit surfaces. Slugs live here;
// labels translate via the "businessNew" i18n namespace (lookingFor.* / social.*).

export const MAX_SECONDARY_SECTORS = 4;

// "Looking for" — what the business wants from the network. Stored as a string[]
// under businesses.credentials.looking_for (jsonb; no DB change).
export const LOOKING_FOR = [
  "partnerships",
  "buyers",
  "suppliers",
  "investment",
  "talent",
  "media",
] as const;
export type LookingFor = (typeof LOOKING_FOR)[number];

// Social presence — stored under businesses.social_links (jsonb). `website` plus
// a bounded set of platforms; empty values are dropped on save.
export const SOCIAL_FIELDS = [
  "website",
  "linkedin",
  "instagram",
  "facebook",
  "x",
] as const;
export type SocialField = (typeof SOCIAL_FIELDS)[number];

export type SocialLinks = Partial<Record<SocialField, string>>;

/** Keep only known, non-empty, trimmed social links for persistence. */
export function cleanSocialLinks(raw: Record<string, string>): SocialLinks {
  const out: SocialLinks = {};
  for (const f of SOCIAL_FIELDS) {
    const v = (raw[f] ?? "").trim();
    if (v) out[f] = v;
  }
  return out;
}

/** Filter an arbitrary list down to valid looking-for slugs (order preserved). */
export function cleanLookingFor(raw: unknown): LookingFor[] {
  if (!Array.isArray(raw)) return [];
  return LOOKING_FOR.filter((k) => raw.includes(k));
}
