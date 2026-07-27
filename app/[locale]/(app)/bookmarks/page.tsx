"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bookmark } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/EmptyState";
import Feed from "@/components/Feed";
import type { FeedPost } from "@/components/PostCard";
import { useApp } from "@/lib/store";
import type { PostView } from "@/lib/feed/reposts";
import { POST_SELECT, buildHydrator, type PostRow } from "@/lib/feed/hydrate";

// BL-SOCIAL-02 §4.5 — the user's saved posts, newest-first. Bookmarks are PRIVATE
// (R4): this only ever reads the caller's own rows (post_bookmarks RLS = own), and
// no count is shown anywhere.
export default function BookmarksPage() {
  const t = useTranslations("social");
  const tHome = useTranslations("home");
  const locale = useLocale();
  const supabase = createClient();
  const { view } = useApp();
  const [items, setItems] = useState<FeedPost[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      if (!user) {
        setLoading(false);
        return;
      }
      const { data: bm } = await supabase
        .from("post_bookmarks")
        .select("post_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      const ids = (bm ?? []).map((b: { post_id: string }) => b.post_id);
      if (ids.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }
      const { data: rows } = await supabase.from("posts").select(POST_SELECT).in("id", ids);
      const list = (rows as PostRow[] | null) ?? [];
      const byId = new Map(list.map((p) => [p.id, p]));
      const toFeedPost = await buildHydrator(supabase, list, user.id, tHome("member"));
      // preserve the bookmark order (newest saved first)
      setItems(ids.map((id) => byId.get(id)).filter((p): p is PostRow => !!p).map((p) => toFeedPost(p)));
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <header>
        <p className="eyebrow text-ink-soft">{t("bookmarksEyebrow")}</p>
        <h1 className="text-xl font-semibold text-ink">{t("bookmarksTitle")}</h1>
        <p className="mt-0.5 text-sm text-ink-soft">{t("bookmarksPrivateNote")}</p>
      </header>

      {loading ? (
        <p className="text-sm text-ink-soft">{t("loading")}</p>
      ) : items.length === 0 ? (
        <EmptyState icon={Bookmark} title={t("bookmarksEmptyTitle")} body={t("bookmarksEmptyBody")} />
      ) : (
        <Feed posts={items} locale={locale} currentView={view as PostView} userId={userId} />
      )}
    </div>
  );
}
