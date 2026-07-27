"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/EmptyState";
import Composer from "./composer";
import { Compass } from "lucide-react";
import ReportButton from "@/components/ReportButton";
import Feed from "@/components/Feed";
import type { FeedPost } from "@/components/PostCard";
import { useApp } from "@/lib/store";
import type { PostView } from "@/lib/feed/reposts";
import { POST_SELECT, buildHydrator, asLang, one, type PostRow } from "@/lib/feed/hydrate";

type RepostRow = {
  post_id: string; user_id: string; quote: string | null; quote_lang: string | null;
  view: string; created_at: string;
  reposter: { name: string | null } | { name: string | null }[] | null;
  posts: PostRow | PostRow[] | null;
};

// Home is the Feed. Originals in the active view + reposts routed into it (§4.5)
// are merged newest-first; each card's action bar owns its own optimistic writes.
export default function HomePage() {
  const t = useTranslations("home");
  const locale = useLocale();
  const supabase = createClient();
  const { view } = useApp();
  const [items, setItems] = useState<FeedPost[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadFeed() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const [{ data: postData }, { data: repostData }] = await Promise.all([
      supabase.from("posts").select(POST_SELECT).or(`view.eq.${view},view.is.null`).order("created_at", { ascending: false }).limit(30),
      supabase
        .from("post_reposts")
        .select(`post_id, user_id, quote, quote_lang, view, created_at, reposter:user_id ( name ), posts:post_id ( ${POST_SELECT} )`)
        .eq("view", view)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

    const originals = (postData as PostRow[] | null) ?? [];
    const reposts = (repostData as RepostRow[] | null) ?? [];

    const underlying: PostRow[] = [...originals];
    for (const r of reposts) {
      const p = one(r.posts);
      if (p) underlying.push(p);
    }

    const toFeedPost = await buildHydrator(supabase, underlying, user?.id ?? null, t("member"));

    const merged: { ts: string; fp: FeedPost }[] = [];
    for (const p of originals) merged.push({ ts: p.created_at, fp: toFeedPost(p) });
    for (const r of reposts) {
      const p = one(r.posts);
      if (!p) continue; // RLS-hidden underlying post — skip, no name leak
      const reposterName = one(r.reposter)?.name ?? t("member");
      if (r.quote) {
        merged.push({ ts: r.created_at, fp: toFeedPost(p, { quote: { text: r.quote, by: reposterName, lang: asLang(r.quote_lang) } }) });
      } else {
        merged.push({ ts: r.created_at, fp: toFeedPost(p, { reposter: { name: reposterName } }) });
      }
    }
    merged.sort((a, b) => (a.ts < b.ts ? 1 : -1));
    setItems(merged.slice(0, 40).map((m) => m.fp));
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("verification_status").eq("id", user.id).single();
        setIsVerified(profile?.verification_status === "verified");
      }
      await loadFeed();
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Composer isVerified={isVerified} onPosted={loadFeed} />

      {loading ? (
        <p className="text-sm text-ink-soft">{t("loading")}</p>
      ) : items.length === 0 ? (
        <EmptyState icon={Compass} title={t("feedEmptyTitle")} body={t("feedEmptyBody")} />
      ) : (
        <Feed
          posts={items}
          locale={locale}
          currentView={view as PostView}
          userId={userId}
          renderAction={(fp) => <ReportButton targetType="post" targetId={fp.id} />}
        />
      )}
    </div>
  );
}
