// Social + website links are STORED, never fetched (BL-BIZ-02 R3/§9). Pure string functions:
// validate the host against an allowlist (social platforms) or accept any https host (website),
// force https, strip query + hash + tracking, cap length. No fetch, HEAD, favicon, oEmbed, or
// preview anywhere in this module.
//
// Moved here from app/[locale]/(app)/business/new/_lib/socialLinks.ts (re-exported from the old
// path) so member profiles (BL-PROFILE-01) and businesses share ONE validator — not a fork.

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "linkedin", "tiktok", "youtube", "x"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

// A member profile's links = the social platforms + a free-form website slot (BL-PROFILE-01).
// Ordered for rendering; the {field: url} shape matches businesses.social_links.
export const PROFILE_LINK_FIELDS = [...SOCIAL_PLATFORMS, "website"] as const;
export type ProfileLinkField = (typeof PROFILE_LINK_FIELDS)[number];

const MAX_LEN = 300;

// Allowed hosts per platform (exact host match, case-insensitive).
const ALLOWLIST: Record<SocialPlatform, string[]> = {
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com"],
  instagram: ["instagram.com", "www.instagram.com"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
  tiktok: ["tiktok.com", "www.tiktok.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
  x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com"],
};

/**
 * Shared cleaner (the single normalisation used by BOTH the allowlisted social links and the
 * any-host website slot — do not duplicate this logic). Trim, assume https for scheme-less input,
 * reject non-http(s), force https, strip query + hash (tracking), keep the path, enforce the
 * length cap. Returns the parsed URL + cleaned string, or null. The HOST is NOT checked here —
 * callers gate it (allowlist for social, any host for website).
 */
function cleanHttpsUrl(raw: string): { url: URL; out: string } | null {
  const input = (raw ?? "").trim();
  if (!input) return null;

  // Accept scheme-less input by assuming https; reject anything non-http(s).
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  // Force https, strip embedded credentials, drop query + hash (tracking), keep the path.
  // Clearing userinfo (`user:pass@`) both closes a stored-credential leak and removes a hover-text
  // that reads like a spoof even when the host is allowlisted (BL-PROFILE-01 residual #1). The host
  // is unchanged, so the allowlist decision is unaffected; this also hardens the business links,
  // which share this cleaner.
  url.protocol = "https:";
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  const out = url.toString();
  if (out.length > MAX_LEN) return null;
  return { url, out };
}

/**
 * Validate + normalize a single social link for a platform. Returns the cleaned https URL (no
 * query/hash), or null if it isn't a valid URL on that platform's allowlist or exceeds the length
 * cap. Bare "handle" input is NOT accepted — a lone handle is ambiguous, so we store what the
 * owner pasted.
 */
export function normalizeSocialLink(platform: SocialPlatform, raw: string): string | null {
  const cleaned = cleanHttpsUrl(raw);
  if (!cleaned) return null;
  if (!ALLOWLIST[platform].includes(cleaned.url.hostname.toLowerCase())) return null;
  return cleaned.out;
}

/**
 * The `website` slot (BL-PROFILE-01): any https host, same cleaning + 300-char cap as the social
 * links, no allowlist. Same no-fetch guarantee.
 */
export function normalizeWebsite(raw: string): string | null {
  const cleaned = cleanHttpsUrl(raw);
  return cleaned ? cleaned.out : null;
}

/**
 * Normalize a bag of {platform: rawUrl} into a clean {platform: url} object, dropping empties and
 * anything that fails validation. Ready to store in businesses.social_links jsonb.
 */
export function normalizeSocialLinks(input: Record<string, string>): Partial<Record<SocialPlatform, string>> {
  const out: Partial<Record<SocialPlatform, string>> = {};
  for (const p of SOCIAL_PLATFORMS) {
    const v = normalizeSocialLink(p, input[p] ?? "");
    if (v) out[p] = v;
  }
  return out;
}

/**
 * Normalize a MEMBER PROFILE's link bag into a clean {field: url} object for profiles.links jsonb
 * (BL-PROFILE-01): the six social platforms via the host allowlist + the website slot via any-host
 * https cleaning; empties + invalid entries dropped.
 *
 * SECURITY (load-bearing): profiles.links is DIRECTLY client-writable (profiles_update_own, no
 * column scope, no server validation, no trigger), so a member can store ARBITRARY jsonb on their
 * OWN row, bypassing the editor. This function is therefore run at BOTH write time (UX) AND RENDER
 * time (components/ProfileLinks.tsx) — the RENDER call is the real boundary. It accepts `unknown`
 * values (jsonb can hold non-strings), coerces non-strings to "", and re-runs the FULL validator,
 * which drops TWO attacks a mere https-prefix check would miss:
 *   - `website: "javascript:alert(1)"` → fails URL parse → dropped (XSS).
 *   - `linkedin: "https://evil.example/harvest"` → https, but NOT on linkedin's allowlist → dropped.
 *      A platform chip renders the platform's icon + name, so a wrong-host value is a PHISHING /
 *      brand-spoof vector, not merely a bad link. (The website slot is any-host by design — it is
 *      labelled "Website", carries no platform branding, and is rel=nofollow.)
 * Do NOT weaken this back to a scheme-prefix check.
 */
export function normalizeProfileLinks(input: Record<string, unknown>): Partial<Record<ProfileLinkField, string>> {
  const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
  const out: Partial<Record<ProfileLinkField, string>> = {};
  for (const p of SOCIAL_PLATFORMS) {
    const v = normalizeSocialLink(p, asStr(input[p]));
    if (v) out[p] = v;
  }
  const w = normalizeWebsite(asStr(input.website));
  if (w) out.website = w;
  return out;
}
