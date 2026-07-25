// Pure guards + extractor for the own-site importer (BL-BIZ-02 §7). Kept out of
// the 'use server' module so they're unit-testable and can be imported normally.
// The SSRF guard here is the security floor: private/loopback/link-local/CGNAT
// addresses are blocked, and this MUST be re-run against every redirect target.

import net from "node:net";
import dns from "node:dns/promises";

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const b = Number(p);
    if (!Number.isInteger(b) || b < 0 || b > 255) return null;
    n = n * 256 + b;
  }
  return n >>> 0;
}

function inV4Cidr(ip: number, base: string, maskBits: number): boolean {
  const b = ipv4ToInt(base)!;
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (ip & mask) === (b & mask);
}

/** True for any non-public IPv4/IPv6 literal (loopback, private, link-local, CGNAT). */
export function isPrivateAddress(addr: string): boolean {
  const ip = addr.replace(/^\[|\]$/g, "").toLowerCase();

  if (net.isIPv4(ip)) {
    const n = ipv4ToInt(ip);
    if (n === null) return true; // unparseable → fail closed
    return (
      inV4Cidr(n, "0.0.0.0", 8) ||
      inV4Cidr(n, "10.0.0.0", 8) ||
      inV4Cidr(n, "127.0.0.0", 8) ||
      inV4Cidr(n, "169.254.0.0", 16) ||
      inV4Cidr(n, "172.16.0.0", 12) ||
      inV4Cidr(n, "192.168.0.0", 16) ||
      inV4Cidr(n, "100.64.0.0", 10)
    );
  }
  if (net.isIPv6(ip)) {
    if (ip === "::1" || ip === "::") return true;
    if (ip.startsWith("fc") || ip.startsWith("fd")) return true; // fc00::/7 (ULA)
    if (ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb")) return true; // fe80::/10
    const mapped = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/); // v4-mapped
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  // Not an IP literal at all → caller must resolve DNS first.
  return true;
}

export type PublicCheck = { ok: true } | { ok: false; reason: "scheme" | "private" | "dns" };

/**
 * Validate a single absolute URL: https only, and its host must resolve to a
 * public address. Call this on the initial URL AND on every redirect Location.
 */
export async function assertPublicUrl(raw: string): Promise<PublicCheck> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "scheme" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "scheme" };

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    return isPrivateAddress(host) ? { ok: false, reason: "private" } : { ok: true };
  }
  // Hostname → resolve all addresses; block if ANY is private (DNS-rebinding safe-ish).
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    return { ok: false, reason: "dns" };
  }
  if (addrs.length === 0) return { ok: false, reason: "dns" };
  for (const a of addrs) if (isPrivateAddress(a.address)) return { ok: false, reason: "private" };
  return { ok: true };
}

export type Extracted = {
  name?: string;
  bio?: string;
  phone?: string;
  city?: string;
  addressLine?: string;
  logoCandidate?: string;
  socialLinks: string[];
};

export type ImportResult =
  | { ok: true; source: "website" | "fixture"; fields: Extracted }
  | { ok: false; reason: "off" | "scheme" | "private" | "dns" | "robots" | "fetch" | "rate" | "timeout" };

/** Minimal robots.txt check for our UA: is `path` Disallow-ed for us or `*`? */
export function robotsDisallows(robotsTxt: string, path: string): boolean {
  const lines = robotsTxt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  let applies = false;
  let disallowed = false;
  for (const line of lines) {
    const [rawKey, ...rest] = line.split(":");
    if (!rawKey) continue;
    const key = rawKey.toLowerCase();
    const val = rest.join(":").trim();
    if (key === "user-agent") {
      applies = val === "*" || /bridgelinkbot/i.test(val);
    } else if (applies && key === "disallow") {
      if (val === "") continue; // empty Disallow = allow all
      if (path.startsWith(val)) disallowed = true;
    }
  }
  return disallowed;
}

function firstMeta(html: string, attr: "property" | "name", key: string): string | undefined {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["']`, "i");
  return html.match(re)?.[1];
}

const SOCIAL_HOSTS = /(facebook|instagram|linkedin|tiktok|youtube|youtu\.be|x\.com|twitter)\./i;

/** Parse the fetched HTML into candidate fields. HTML itself is never stored. */
export function extractFromHtml(html: string): Extracted {
  const out: Extracted = { socialLinks: [] };

  // JSON-LD Organization/LocalBusiness first.
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const m of ld) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : parsed["@graph"] ? parsed["@graph"] : [parsed];
      for (const node of nodes) {
        const type = String(node?.["@type"] ?? "");
        if (/Organization|LocalBusiness/i.test(type)) {
          out.name ??= typeof node.name === "string" ? node.name : undefined;
          out.bio ??= typeof node.description === "string" ? node.description : undefined;
          out.phone ??= typeof node.telephone === "string" ? node.telephone : undefined;
          const addr = node.address;
          if (addr && typeof addr === "object") {
            out.city ??= typeof addr.addressLocality === "string" ? addr.addressLocality : undefined;
            out.addressLine ??= typeof addr.streetAddress === "string" ? addr.streetAddress : undefined;
          }
          if (Array.isArray(node.sameAs)) {
            for (const s of node.sameAs) if (typeof s === "string" && SOCIAL_HOSTS.test(s)) out.socialLinks.push(s);
          }
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }

  out.name ??= firstMeta(html, "property", "og:site_name") ?? firstMeta(html, "property", "og:title") ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  out.bio ??= firstMeta(html, "property", "og:description") ?? firstMeta(html, "name", "description");
  out.logoCandidate ??= firstMeta(html, "property", "og:image");
  return out;
}
