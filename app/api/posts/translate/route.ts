import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getTranslationProvider } from "@/lib/translation";
import type { BodyLang } from "@/lib/detectLang";

export const runtime = "nodejs";

// On-demand, cached post translation. Auth-required and owner-agnostic: any
// signed-in viewer who can see a post may request its translation into their
// locale. The translation is computed once and cached on the row (write-once),
// so subsequent viewers — and re-renders — never re-translate.

// Best-effort in-memory rate limit (sliding window, per user). Serverless =
// per-instance, not global; it caps a single hot client, not the whole fleet.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

export async function POST(request: Request) {
  // Auth (user-scoped client — reads are RLS-gated to what the caller can see).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (rateLimited(user.id)) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  let postId: string | undefined;
  try {
    ({ postId } = (await request.json()) as { postId?: string });
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!postId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // RLS-scoped read: only translatable if the caller can see it.
  const { data: post } = await supabase
    .from("posts")
    .select("id, body, body_lang, body_translated, body_translated_lang")
    .eq("id", postId)
    .maybeSingle();
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const bodyLang: BodyLang = post.body_lang === "ne" ? "ne" : "en";
  const target: BodyLang = bodyLang === "en" ? "ne" : "en";

  // Already cached — one translation per post, ever.
  if (post.body_translated && post.body_translated_lang === target) {
    return NextResponse.json({ translated: post.body_translated, lang: target, cached: true });
  }

  let translated: string;
  try {
    translated = await getTranslationProvider().translate(post.body, bodyLang, target);
  } catch {
    // Provider not configured or upstream failure — the client keeps showing the
    // original (translation is never allowed to block the feed).
    return NextResponse.json({ error: "translate_unavailable" }, { status: 503 });
  }

  // Cache server-side with the SERVICE ROLE — never a client-callable RPC. The
  // translation is computed from the post's OWN body above, so nothing
  // attacker-controlled is ever persisted (the old cache_post_translation RPC let
  // any authenticated caller write an arbitrary translation onto any post). Guards:
  // a length cap (a translation must not dwarf its source — with a small floor so
  // tiny posts aren't falsely rejected) and a sane target language. The `.is(null)`
  // filter keeps it write-once even under concurrent requests. Best-effort — a
  // missing service key or failed write still returns the translation (the feed
  // never blocks on translation; it simply isn't persisted, and re-translates next
  // time).
  const withinCap = translated.length <= Math.max(post.body.length * 4, 240);
  const targetOk = target === "en" || target === "ne";
  const service = createServiceClient();
  let cached = false;
  if (service && withinCap && targetOk) {
    const { error } = await service
      .from("posts")
      .update({ body_translated: translated, body_translated_lang: target })
      .eq("id", postId)
      .is("body_translated", null);
    cached = !error;
  }

  return NextResponse.json({ translated, lang: target, cached });
}
