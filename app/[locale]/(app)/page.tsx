"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/EmptyState";
import Composer from "./composer";
import { Compass } from "lucide-react";
import ReportButton from "@/components/ReportButton";
import Feed from "@/components/Feed";
import FeedMessenger from "@/components/FeedMessenger";
import NepaliAlmanac from "@/components/NepaliAlmanac";
import FloatingChatDock, { type OpenChat } from "@/components/FloatingChatDock";
import type { FeedPost } from "@/components/PostCard";
import { useApp } from "@/lib/store";
import type { PostView } from "@/lib/feed/reposts";
import { POST_SELECT, buildHydrator, asLang, one, type PostRow } from "@/lib/feed/hydrate";

// D-076. At most this many floating chat popups stay open at once — opening a
// new one evicts the oldest (front of the array = most recently opened). A
// Feed-only-scope tradeoff, smaller than real Facebook's stack; see CLAUDE.md.
const MAX_OPEN_CHATS = 2;

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
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);

  // Opening a thread already open just re-surfaces (un-minimizes) it rather than
  // duplicating an entry; opening a new one beyond MAX_OPEN_CHATS evicts the
  // oldest, matching the minimal FB-style stack described above.
  function openThread(threadId: string, name: string) {
    setOpenChats((prev) => {
      const rest = prev.filter((c) => c.threadId !== threadId);
      return [{ threadId, name, minimized: false }, ...rest].slice(0, MAX_OPEN_CHATS);
    });
  }
  function closeChat(threadId: string) {
    setOpenChats((prev) => prev.filter((c) => c.threadId !== threadId));
  }
  function toggleMinimize(threadId: string) {
    setOpenChats((prev) => prev.map((c) => (c.threadId === threadId ? { ...c, minimized: !c.minimized } : c)));
  }

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
    // Single column below xl (unchanged from before D-076); at xl+ a fixed
    // 42rem (=max-w-2xl) feed column plus a 20rem messenger rail, still capped
    // by AppShell's own max-w-5xl main so it never grows unbounded on very wide
    // screens. xl:space-y-0 turns off the base space-y-3 stacking gap, which
    // would otherwise add stray top margin to the rail once this is a grid.
    <div className="mx-auto max-w-2xl space-y-3 xl:max-w-none xl:grid xl:grid-cols-[42rem_20rem] xl:items-start xl:gap-6 xl:space-y-0">
      <div className="space-y-3">
        {/* Nepali-calendar habit anchor. The full card lives in the xl: rail
            below; this compact chip carries it below xl (the hub's redirect so
            it isn't desktop-only). One or the other shows, never both. */}
        <div className="xl:hidden">
          <NepaliAlmanac variant="chip" />
        </div>
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

      {/* Feed-only per product decision (not a site-wide rail) — hidden below
          xl, where there isn't room for a feed column plus a rail. The Nepali
          almanac card sits above the messenger; below xl it's the inline chip. */}
      <aside className="hidden space-y-4 xl:sticky xl:top-6 xl:block">
        <NepaliAlmanac variant="full" />
        <FeedMessenger onOpenThread={openThread} />
      </aside>

      <FloatingChatDock chats={openChats} onClose={closeChat} onToggleMinimize={toggleMinimize} />
    </div>
  );
}
