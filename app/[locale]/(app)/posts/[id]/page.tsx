"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import PostCard, { type FeedPost } from "@/components/PostCard";
import EmptyState from "@/components/EmptyState";
import ReportButton from "@/components/ReportButton";
import { FileQuestion } from "lucide-react";
import { POST_SELECT, buildHydrator, type PostRow } from "@/lib/feed/hydrate";

// BL-SOCIAL-02 §4.1 — the permalink target that Share (copy link / send in a DM)
// points at. Renders the single post with its comment thread open.
export default function PostPermalinkPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const locale = useLocale();
  const t = useTranslations("social");
  const tHome = useTranslations("home");
  const supabase = createClient();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      const { data: row } = await supabase.from("posts").select(POST_SELECT).eq("id", id).maybeSingle();
      if (!row) {
        setPost(null);
        setLoading(false);
        return;
      }
      const toFeedPost = await buildHydrator(supabase, [row as PostRow], user?.id ?? null, tHome("member"));
      setPost(toFeedPost(row as PostRow));
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div className="mx-auto max-w-xl space-y-3">
      {loading ? (
        <p className="text-sm text-ink-soft">{t("loading")}</p>
      ) : !post ? (
        <EmptyState icon={FileQuestion} title={t("postNotFoundTitle")} body={t("postNotFoundBody")} />
      ) : (
        <PostCard
          post={post}
          locale={locale}
          currentView={post.view}
          userId={userId}
          defaultCommentsOpen
          action={<ReportButton targetType="post" targetId={post.id} />}
        />
      )}
    </div>
  );
}
