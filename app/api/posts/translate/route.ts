import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  // Cache it via a SECURITY DEFINER RPC (owner-agnostic — the caller isn't the
  // post owner). The function is auth-gated, writes ONLY the two translation
  // columns, and only when still null, so it's write-once even under concurrent
  // requests. Best-effort: a failed cache still returns the translation (the
  // feed must never block on translation).
  await supabase.rpc("cache_post_translation", {
    p_post_id: postId,
    p_translation: translated,
    p_lang: target,
  });

  return NextResponse.json({ translated, lang: target, cached: false });
}
