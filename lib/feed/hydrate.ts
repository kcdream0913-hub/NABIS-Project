"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedPost } from "@/components/PostCard";
import type { BodyLang } from "@/lib/detectLang";
import type { PostView } from "./reposts";
import type { ReactionKind } from "./reactions";
import { isReactionKind } from "./reactions";
import type { PostMedia } from "./media";
import { collectMediaPaths, fetchSignedUrls } from "./mediaUpload";

// The one column list every post-rendering surface selects (feed, bookmarks,
// permalink). Counts come from PostgREST embedded aggregates (R5 — no denormalized
// counter columns).
export const POST_SELECT =
  "id, author_id, body, body_lang, body_translated, body_translated_lang, created_at, posted_as, view, media, profiles:author_id ( name, avatar_url, verification_status, bridge ), businesses:business_id ( name, logo_url, verification_status ), post_comments(count), post_reposts(count)";

type Prof = { name: string | null; avatar_url: string | null; verification_status: string | null; bridge: boolean | null };
type Biz = { name: string | null; logo_url: string | null; verification_status: string | null };
export type PostRow = {
  id: string; author_id: string; body: string;
  body_lang: string | null; body_translated: string | null; body_translated_lang: string | null;
  created_at: string; posted_as: string; view: string | null; media: unknown;
  profiles: Prof | Prof[] | null; businesses: Biz | Biz[] | null;
  post_comments?: { count: number }[]; post_reposts?: { count: number }[];
};

export const asView = (v: string | null): PostView => (v === "us" || v === "nepal" || v === "bridge" ? v : "bridge");
export const asLang = (v: string | null): BodyLang => (v === "ne" ? "ne" : "en");
export const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

export function parseMedia(raw: unknown): PostMedia[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is PostMedia =>
      !!m && typeof m === "object" && (m as { type?: string }).type != null && typeof (m as { path?: string }).path === "string",
  );
}

// Fetch social state (reactions by kind + mine, my reposts, my bookmarks) and
// batched signed URLs for a set of post rows, and return a mapper that turns any
// of those rows into a FeedPost. One social fetch + one signed-URL request total.
export async function buildHydrator(
  supabase: SupabaseClient,
  rows: PostRow[],
  userId: string | null,
  memberFallback: string,
): Promise<(row: PostRow, decorate?: Partial<FeedPost>) => FeedPost> {
  const ids = Array.from(new Set(rows.map((p) => p.id)));

  const [{ data: reacts }, { data: myReposts }, { data: myBookmarks }] = await Promise.all([
    ids.length ? supabase.from("post_reactions").select("post_id, user_id, kind").in("post_id", ids) : Promise.resolve({ data: [] }),
    userId && ids.length ? supabase.from("post_reposts").select("post_id, view").eq("user_id", userId).in("post_id", ids) : Promise.resolve({ data: [] }),
    userId && ids.length ? supabase.from("post_bookmarks").select("post_id").eq("user_id", userId).in("post_id", ids) : Promise.resolve({ data: [] }),
  ]);

  const counts: Record<string, Partial<Record<ReactionKind, number>>> = {};
  const mineReact: Record<string, ReactionKind> = {};
  for (const r of (reacts as { post_id: string; user_id: string; kind: string }[] | null) ?? []) {
    if (!isReactionKind(r.kind)) continue;
    (counts[r.post_id] ??= {})[r.kind] = ((counts[r.post_id] ?? {})[r.kind] ?? 0) + 1;
    if (userId && r.user_id === userId) mineReact[r.post_id] = r.kind;
  }
  const mineRepost: Record<string, PostView> = {};
  for (const r of (myReposts as { post_id: string; view: string }[] | null) ?? []) mineRepost[r.post_id] = asView(r.view);
  const booked = new Set<string>();
  for (const b of (myBookmarks as { post_id: string }[] | null) ?? []) booked.add(b.post_id);

  const allMedia = rows.flatMap((p) => parseMedia(p.media));
  const urls = await fetchSignedUrls(collectMediaPaths(allMedia));

  return (p: PostRow, decorate: Partial<FeedPost> = {}): FeedPost => {
    const author = one(p.profiles);
    const business = one(p.businesses);
    return {
      id: p.id,
      body: p.body,
      bodyLang: asLang(p.body_lang),
      bodyTranslated: p.body_translated,
      bodyTranslatedLang: p.body_translated_lang === "ne" ? "ne" : p.body_translated_lang === "en" ? "en" : null,
      created_at: p.created_at,
      view: asView(p.view),
      posted_as: p.posted_as === "business" ? "business" : "user",
      author: {
        id: p.author_id,
        name: author?.name ?? memberFallback,
        avatar_url: author?.avatar_url,
        verification_status: author?.verification_status === "verified" ? "verified" : "unverified",
        tier: author?.bridge ? "bridge" : undefined,
      },
      business: business
        ? { id: "", name: business.name ?? memberFallback, logo_url: business.logo_url, verification_status: business.verification_status === "verified" ? "verified" : "unverified" }
        : null,
      media: parseMedia(p.media),
      mediaUrls: urls,
      reactionCounts: counts[p.id] ?? {},
      myReaction: mineReact[p.id] ?? null,
      commentCount: p.post_comments?.[0]?.count ?? 0,
      repostCount: p.post_reposts?.[0]?.count ?? 0,
      myRepostView: mineRepost[p.id] ?? null,
      bookmarked: booked.has(p.id),
      ...decorate,
    };
  };
}
