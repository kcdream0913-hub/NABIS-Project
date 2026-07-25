// Social links are STORED, never fetched (BL-BIZ-02 R3/§9). Pure string functions:
// validate the host against an allowlist, force https, strip query + hash + tracking,
// cap length. No fetch, HEAD, favicon, oEmbed, or preview anywhere in this module.

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "linkedin", "tiktok", "youtube", "x"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

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
 * Validate + normalize a single social link for a platform. Returns the cleaned
 * https URL (no query/hash), or null if it isn't a valid URL on that platform's
 * allowlist or exceeds the length cap. Bare "handle" input is NOT accepted — we
 * store what the owner pasted, and a lone handle is ambiguous.
 */
export function normalizeSocialLink(platform: SocialPlatform, raw: string): string | null {
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

  const host = url.hostname.toLowerCase();
  if (!ALLOWLIST[platform].includes(host)) return null;

  // Force https, drop query + hash (tracking), keep the path.
  url.protocol = "https:";
  url.search = "";
  url.hash = "";
  let out = url.toString();
  // URL keeps a trailing slash for a bare host; leave paths as-is otherwise.
  if (out.length > MAX_LEN) return null;
  return out;
}

/**
 * Normalize a bag of {platform: rawUrl} into a clean {platform: url} object,
 * dropping empties and anything that fails validation. Ready to store in
 * businesses.social_links jsonb.
 */
export function normalizeSocialLinks(input: Record<string, string>): Partial<Record<SocialPlatform, string>> {
  const out: Partial<Record<SocialPlatform, string>> = {};
  for (const p of SOCIAL_PLATFORMS) {
    const v = normalizeSocialLink(p, input[p] ?? "");
    if (v) out[p] = v;
  }
  return out;
}
