"use server";

// Owner's-own-site importer (BL-BIZ-02 §7). Server-only. Never a general URL
// fetcher: https-only, SSRF-guarded on the initial URL AND every redirect target,
// robots.txt honored, 5s timeout, 1MB streamed cap, 5/hour per user. Never stores
// HTML; never hotlinks a logo (returns a candidate the owner must re-upload). No
// social host is ever fetched (R3). Modes: live | fixture | off; CI runs fixture.

import { createClient } from "@/lib/supabase/server";
import { assertPublicUrl, extractFromHtml, robotsDisallows, type ImportResult } from "./websiteGuards";
import { WEBSITE_FIXTURE } from "./fixtures";

const MODE = (process.env.WEBSITE_IMPORT_MODE ?? "off") as "live" | "fixture" | "off";
const UA = "BridgeLinkBot/1.0 (+https://nabis-project.vercel.app/about/bot)";
const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

// Best-effort per-user rate limit. In-memory → resets on cold start; a durable
// limiter belongs in the edge/KV layer, out of scope here.
const hits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const windowStart = now - 3_600_000;
  const recent = (hits.get(userId) ?? []).filter((t) => t > windowStart);
  if (recent.length >= 5) return true;
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

async function fetchCapped(url: string, signal: AbortSignal): Promise<{ status: number; location: string | null; body: string }> {
  const res = await fetch(url, {
    method: "GET",
    redirect: "manual",
    signal,
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
  });
  const location = res.headers.get("location");
  if (res.status >= 300 && res.status < 400) return { status: res.status, location, body: "" };

  // Stream with a hard byte cap — abort rather than read-then-check.
  const reader = res.body?.getReader();
  if (!reader) return { status: res.status, location: null, body: "" };
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  }
  return { status: res.status, location: null, body: new TextDecoder().decode(concat(chunks)) };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export async function importWebsite(rawUrl: string): Promise<ImportResult> {
  if (MODE === "off") return { ok: false, reason: "off" };

  // Authenticated + rate-limited even in fixture mode.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "fetch" };
  if (rateLimited(user.id)) return { ok: false, reason: "rate" };

  if (MODE === "fixture") return { ok: true, source: "fixture", fields: WEBSITE_FIXTURE };

  // live: full guard sequence.
  let current = rawUrl.trim();
  const firstCheck = await assertPublicUrl(current);
  if (!firstCheck.ok) return { ok: false, reason: firstCheck.reason };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // robots.txt for the origin, checked before the page fetch.
    const origin = new URL(current).origin;
    try {
      const robotsRes = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": UA }, signal: controller.signal });
      if (robotsRes.ok) {
        const txt = (await robotsRes.text()).slice(0, 100_000);
        if (robotsDisallows(txt, new URL(current).pathname || "/")) return { ok: false, reason: "robots" };
      }
    } catch {
      // robots fetch failure is not a hard block; proceed to the page fetch.
    }

    // Follow up to MAX_REDIRECTS, re-checking every hop (the case that ships broken).
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const { status, location, body } = await fetchCapped(current, controller.signal);
      if (status >= 300 && status < 400 && location) {
        const next = new URL(location, current).toString();
        const check = await assertPublicUrl(next); // re-validate the redirect target
        if (!check.ok) return { ok: false, reason: check.reason };
        current = next;
        continue;
      }
      if (status >= 200 && status < 300 && body) {
        return { ok: true, source: "website", fields: extractFromHtml(body) };
      }
      return { ok: false, reason: "fetch" };
    }
    return { ok: false, reason: "fetch" }; // too many redirects
  } catch (e) {
    return { ok: false, reason: e instanceof Error && e.name === "AbortError" ? "timeout" : "fetch" };
  } finally {
    clearTimeout(timer);
  }
}
