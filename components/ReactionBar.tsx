"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * ReactionBar — the feed post footer. The like is real: it writes to
 * `post_reactions` (insert/delete-own) optimistically and rolls the UI back if
 * the write fails, so the bar never asserts a reaction that was not persisted.
 * Comment + share stay affordance-only scaffolds (comments are a later feature;
 * share can grow into a native share sheet).
 */
export function ReactionBar({
  postId,
  initialLiked = false,
  likeCount = 0,
  commentCount = 0,
}: {
  postId: string;
  initialLiked?: boolean;
  likeCount?: number;
  commentCount?: number;
}) {
  const t = useTranslations("feed");
  const supabase = createClient();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(likeCount);
  const [busy, setBusy] = useState(false);

  async function toggleLike() {
    if (busy) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const next = !liked;
    // Optimistic flip first, then reconcile with the exact inverse on failure.
    setLiked(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    setBusy(true);

    const { error } = next
      ? await supabase.from("post_reactions").insert({ post_id: postId, user_id: user.id })
      : await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", user.id);

    if (error) {
      setLiked(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
    }
    setBusy(false);
  }

  const Btn = ({ onClick, active, disabled, icon: Icon, label, n }:
    { onClick?: () => void; active?: boolean; disabled?: boolean; icon: typeof Heart; label: string; n?: number }) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition hover:bg-surface-2 disabled:opacity-70 disabled:hover:bg-transparent
        ${active ? "text-accent" : "text-ink-soft"}`}>
      <Icon size={17} strokeWidth={2} fill={active ? "currentColor" : "none"} />
      {label}{n ? <span className="tabular-nums">· {n}</span> : null}
    </button>
  );

  return (
    <footer className="flex items-center gap-1 border-t border-border px-2 py-1.5">
      <Btn onClick={toggleLike} active={liked} icon={Heart} label={t("react")} n={count} />
      <Btn icon={MessageCircle} label={t("comment")} n={commentCount} disabled />
      <span className="flex-1" />
      <Btn icon={Share2} label={t("share")} disabled />
    </footer>
  );
}
