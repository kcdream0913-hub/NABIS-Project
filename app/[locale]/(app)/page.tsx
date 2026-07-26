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

type FeedProfile = {
  name: string | null;
  avatar_url: string | null;
  verification_status: string | null;
  bridge: boolean | null;
};
type FeedBusiness = {
  name: string | null;
  logo_url: string | null;
  verification_status: string | null;
};
type Post = {
  id: string;
  body: string;
  body_lang: string | null;
  body_translated: string | null;
  body_translated_lang: string | null;
  created_at: string;
  posted_as: string;
  view: string | null;
  profiles: FeedProfile | FeedProfile[] | null;
  businesses: FeedBusiness | FeedBusiness[] | null;
};

// Home is the Feed (Facebook/X pattern). Messages moved to its own /messages
// destination — no more Feed|Messages toggle here.
export default function HomePage() {
  const t = useTranslations("home");
  const locale = useLocale();
  const supabase = createClient();
  const { view } = useApp();
  const [posts, setPosts] = useState<Post[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set());
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadFeed() {
    // View-aware feed (spec §5.6/§5.8): the active country view filters the
    // stream. Posts created before view-stamping (view null) stay visible.
    const { data } = await supabase
      .from("posts")
      .select(
        "id, body, body_lang, body_translated, body_translated_lang, created_at, posted_as, view, profiles:author_id ( name, avatar_url, verification_status, bridge ), businesses:business_id ( name, logo_url, verification_status )"
      )
      .or(`view.eq.${view},view.is.null`)
      .order("created_at", { ascending: false })
      .limit(30);
    const list = (data as Post[] | null) ?? [];
    setPosts(list);

    // Reactions for the visible posts: counts + which ones I've reacted to.
    const ids = list.map((p) => p.id);
    if (ids.length === 0) {
      setReactionCounts({});
      setMyReactions(new Set());
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: reacts } = await supabase
      .from("post_reactions")
      .select("post_id, user_id")
      .in("post_id", ids);
    const counts: Record<string, number> = {};
    const mine = new Set<string>();
    for (const r of reacts ?? []) {
      counts[r.post_id] = (counts[r.post_id] ?? 0) + 1;
      if (user && r.user_id === user.id) mine.add(r.post_id);
    }
    setReactionCounts(counts);
    setMyReactions(mine);
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("verification_status")
          .eq("id", user.id)
          .single();
        setIsVerified(profile?.verification_status === "verified");
      }
      await loadFeed();
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Map the loaded rows to the presentational FeedPost shape. Reaction seeds
  // come from the bulk load; each card's ReactionBar owns its own toggle after.
  const feedPosts: FeedPost[] = posts.map((p) => {
    const author = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    const business = Array.isArray(p.businesses) ? p.businesses[0] : p.businesses;
    const postView: FeedPost["view"] =
      p.view === "us" || p.view === "nepal" || p.view === "bridge" ? p.view : "bridge";
    return {
      id: p.id,
      body: p.body,
      bodyLang: p.body_lang === "ne" ? "ne" : "en",
      bodyTranslated: p.body_translated,
      bodyTranslatedLang: p.body_translated_lang === "ne" ? "ne" : p.body_translated_lang === "en" ? "en" : null,
      created_at: p.created_at,
      view: postView,
      posted_as: p.posted_as === "business" ? "business" : "user",
      author: {
        id: "",
        name: author?.name ?? t("member"),
        avatar_url: author?.avatar_url,
        verification_status: author?.verification_status === "verified" ? "verified" : "unverified",
        tier: author?.bridge ? "bridge" : undefined,
      },
      business: business
        ? {
            id: "",
            name: business.name ?? t("member"),
            logo_url: business.logo_url,
            verification_status: business.verification_status === "verified" ? "verified" : "unverified",
          }
        : null,
      likeCount: reactionCounts[p.id] ?? 0,
      commentCount: 0,
      likedByMe: myReactions.has(p.id),
    };
  });

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Composer isVerified={isVerified} onPosted={loadFeed} />

      {loading ? (
        <p className="text-sm text-ink-soft">{t("loading")}</p>
      ) : posts.length === 0 ? (
        <EmptyState icon={Compass} title={t("feedEmptyTitle")} body={t("feedEmptyBody")} />
      ) : (
        <Feed
          posts={feedPosts}
          locale={locale}
          renderAction={(fp) => <ReportButton targetType="post" targetId={fp.id} />}
        />
      )}
    </div>
  );
}
