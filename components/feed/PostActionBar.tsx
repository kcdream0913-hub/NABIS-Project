"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle, Repeat2, Share2, Bookmark, Smile } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";
import { detectBodyLang } from "@/lib/detectLang";
import {
  nextReaction,
  reactionCountDelta,
  summaryEmojis,
  totalReactions,
  reactionMeta,
  type ReactionKind,
} from "@/lib/feed/reactions";
import { visibleRepostTargets, type PostView } from "@/lib/feed/reposts";
import ReactionPicker from "./ReactionPicker";
import ShareMenu from "./ShareMenu";

export type ActionInitial = {
  reactionCounts: Partial<Record<ReactionKind, number>>;
  myReaction: ReactionKind | null;
  commentCount: number;
  repostCount: number;
  myRepostView: PostView | null;
  bookmarked: boolean;
};

const HOVER_OPEN_MS = 400;

export default function PostActionBar({
  postId,
  postView,
  currentView,
  permalink,
  quoteText,
  initialUserId,
  commentsOpen,
  onToggleComments,
  initial,
}: {
  postId: string;
  postView: PostView;
  currentView: PostView;
  permalink: string;
  quoteText: string | null;
  initialUserId: string | null;
  commentsOpen: boolean;
  onToggleComments: () => void;
  initial: ActionInitial;
}) {
  const t = useTranslations("social");
  const supabase = createClient();
  const liveId = useId();

  const [userId, setUserId] = useState<string | null>(initialUserId);
  useEffect(() => {
    if (userId) return;
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [userId, supabase]);

  // ── reactions ──
  const [counts, setCounts] = useState(initial.reactionCounts);
  const [mine, setMine] = useState<ReactionKind | null>(initial.myReaction);
  const [pickerOpen, setPickerOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── repost / share / bookmark ──
  const [repostCount, setRepostCount] = useState(initial.repostCount);
  const [myRepost, setMyRepost] = useState<PostView | null>(initial.myRepostView);
  const [repostMenu, setRepostMenu] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [bookmarked, setBookmarked] = useState(initial.bookmarked);
  const [toast, setToast] = useState<{ text: string; href?: string; hrefLabel?: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(text: string, href?: string, hrefLabel?: string) {
    setToast({ text, href, hrefLabel });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  const total = totalReactions(counts);
  const emojis = summaryEmojis(counts, 3);
  const repostTargets = visibleRepostTargets(postView, currentView);

  async function applyReaction(kind: ReactionKind) {
    setPickerOpen(false);
    if (!userId) return;
    const next = nextReaction(mine, kind);
    const prevCounts = counts;
    const prevMine = mine;
    // optimistic
    const nc: Partial<Record<ReactionKind, number>> = { ...counts };
    if (prevMine) nc[prevMine] = Math.max(0, (nc[prevMine] ?? 0) - 1);
    if (next) nc[next] = (nc[next] ?? 0) + 1;
    setCounts(nc);
    setMine(next);

    // Add or change = a single upsert on the (post_id, user_id) PK, so a
    // change-of-kind emits ONE realtime UPDATE (not a DELETE+INSERT that would make
    // the reaction blink off/on for other live viewers). Relies on the prod
    // post_reactions_update_own policy. Remove = a delete.
    const { error } = next
      ? await supabase
          .from("post_reactions")
          .upsert({ post_id: postId, user_id: userId, kind: next }, { onConflict: "post_id,user_id" })
      : await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) {
      setCounts(prevCounts);
      setMine(prevMine);
      showToast(t("actionFailed"));
    }
  }

  function openPickerSoon() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setPickerOpen(true), HOVER_OPEN_MS);
  }
  function cancelPickerHover() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }

  async function doRepost(target: PostView, quote?: string) {
    setRepostMenu(false);
    setQuoteOpen(false);
    if (!userId) return;
    const prevCount = repostCount;
    const prevMine = myRepost;
    setRepostCount((c) => c + 1);
    setMyRepost(target);
    const payload: Record<string, unknown> = { post_id: postId, user_id: userId, view: target };
    if (quote && quote.trim()) {
      payload.quote = quote.trim();
      payload.quote_lang = detectBodyLang(quote);
    }
    const { error } = await supabase.from("post_reposts").insert(payload);
    if (error) {
      setRepostCount(prevCount);
      setMyRepost(prevMine);
      showToast(t("actionFailed"));
    } else {
      showToast(quote ? t("quoted") : t("reposted"));
    }
  }

  async function undoRepost() {
    setRepostMenu(false);
    if (!userId) return;
    const prevCount = repostCount;
    const prevMine = myRepost;
    setRepostCount((c) => Math.max(0, c - 1));
    setMyRepost(null);
    const { error } = await supabase.from("post_reposts").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) {
      setRepostCount(prevCount);
      setMyRepost(prevMine);
      showToast(t("actionFailed"));
    }
  }

  async function toggleBookmark() {
    if (!userId) return;
    const next = !bookmarked;
    setBookmarked(next);
    const { error } = next
      ? await supabase.from("post_bookmarks").insert({ post_id: postId, user_id: userId })
      : await supabase.from("post_bookmarks").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) {
      setBookmarked(!next);
      showToast(t("actionFailed"));
    } else if (next) {
      showToast(t("saved"), "/bookmarks", t("viewBookmarks"));
    }
  }

  const reactActive = mine !== null;
  const reactLabel = mine ? reactionMeta(mine).emoji : null;

  return (
    <footer className="border-t border-border">
      <div className="flex items-center gap-0.5 px-2 py-1">
        {/* React */}
        <div className="relative">
          {pickerOpen && (
            <div
              className="absolute bottom-full left-0 z-20 mb-1"
              onMouseEnter={cancelPickerHover}
              onMouseLeave={() => setPickerOpen(false)}
            >
              <ReactionPicker current={mine} onPick={applyReaction} onClose={() => setPickerOpen(false)} />
            </div>
          )}
          <button
            type="button"
            aria-pressed={reactActive}
            aria-label={t("reactAria", { count: total })}
            onClick={() => applyReaction("like")}
            onPointerEnter={(e) => e.pointerType !== "touch" && openPickerSoon()}
            onPointerLeave={cancelPickerHover}
            onTouchStart={openPickerSoon}
            onTouchEnd={cancelPickerHover}
            onContextMenu={(e) => e.preventDefault()}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition hover:bg-surface-2 ${
              reactActive ? "text-primary" : "text-ink-soft"
            }`}
          >
            {reactLabel ? (
              <span className="text-base" aria-hidden>{reactLabel}</span>
            ) : (
              <Smile size={18} strokeWidth={2} />
            )}
            <span>{mine ? t(`reactions.${mine}`) : t("react")}</span>
            {emojis.length > 0 && (
              <span className="ml-0.5 inline-flex items-center gap-0.5">
                <span aria-hidden className="text-[13px] leading-none">{emojis.join("")}</span>
                <span className="tabular-nums">{total}</span>
              </span>
            )}
          </button>
        </div>

        {/* Comment */}
        <button
          type="button"
          aria-pressed={commentsOpen}
          aria-label={t("commentAria", { count: initial.commentCount })}
          onClick={onToggleComments}
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition hover:bg-surface-2 ${
            commentsOpen ? "text-primary" : "text-ink-soft"
          }`}
        >
          <MessageCircle size={18} />
          {initial.commentCount > 0 ? <span className="tabular-nums">{initial.commentCount}</span> : null}
        </button>

        {/* Repost */}
        <div className="relative">
          <button
            type="button"
            aria-pressed={myRepost !== null}
            aria-haspopup="menu"
            aria-expanded={repostMenu}
            disabled={myRepost === null && repostTargets.length === 0}
            aria-label={t("repostAria", { count: repostCount })}
            onClick={() => setRepostMenu((o) => !o)}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-transparent ${
              myRepost ? "text-primary" : "text-ink-soft"
            }`}
          >
            <Repeat2 size={18} />
            {repostCount > 0 ? <span className="tabular-nums">{repostCount}</span> : null}
          </button>
          {repostMenu && (
            <div role="menu" className="absolute bottom-full left-0 z-20 mb-1 w-52 rounded-lg border border-border bg-surface p-1 shadow-raised">
              {myRepost ? (
                <button type="button" role="menuitem" onClick={undoRepost} className="w-full rounded-md px-3 py-2.5 text-left text-sm text-accent hover:bg-surface-2">
                  {t("undoRepost")}
                </button>
              ) : (
                <>
                  {repostTargets.map((target) => (
                    <button
                      key={target}
                      type="button"
                      role="menuitem"
                      onClick={() => doRepost(target)}
                      className="w-full rounded-md px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-2"
                    >
                      {repostTargets.length === 1 ? t("repost") : t(`repostTo.${target}`)}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setRepostMenu(false); setQuoteOpen(true); }}
                    className="w-full rounded-md px-3 py-2.5 text-left text-sm text-ink hover:bg-surface-2"
                  >
                    {t("quote")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <span className="flex-1" />

        {/* Share */}
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={shareOpen}
            aria-label={t("share")}
            onClick={() => setShareOpen((o) => !o)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-soft transition hover:bg-surface-2"
          >
            <Share2 size={18} />
          </button>
          {shareOpen && userId && (
            <div className="absolute bottom-full right-0 z-20 mb-1">
              <ShareMenu
                postId={postId}
                userId={userId}
                permalink={permalink}
                quoteText={quoteText}
                onToast={showToast}
                onClose={() => setShareOpen(false)}
              />
            </div>
          )}
        </div>

        {/* Bookmark (private, no count — R4) */}
        <button
          type="button"
          aria-pressed={bookmarked}
          aria-label={bookmarked ? t("bookmarkRemoveAria") : t("bookmarkAria")}
          onClick={toggleBookmark}
          className={`inline-flex min-h-[44px] items-center justify-center rounded-lg px-2.5 py-1.5 transition hover:bg-surface-2 ${
            bookmarked ? "text-primary" : "text-ink-soft"
          }`}
        >
          <Bookmark size={18} fill={bookmarked ? "currentColor" : "none"} />
        </button>
      </div>

      {/* Quote composer */}
      {quoteOpen && (
        <QuoteComposer
          targets={repostTargets}
          onCancel={() => setQuoteOpen(false)}
          onSubmit={(text, target) => doRepost(target, text)}
        />
      )}

      {/* one polite live region per card (§4.6) */}
      <span id={liveId} aria-live="polite" className="sr-only">
        {t("reactionCountLive", { count: total })}
      </span>

      {toast && (
        <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-[13px] text-ink-soft" role="status">
          <span>{toast.text}</span>
          {toast.href && toast.hrefLabel && (
            <Link href={toast.href} className="font-medium text-primary">· {toast.hrefLabel}</Link>
          )}
        </div>
      )}
    </footer>
  );
}

function QuoteComposer({
  targets,
  onCancel,
  onSubmit,
}: {
  targets: PostView[];
  onCancel: () => void;
  onSubmit: (text: string, target: PostView) => void;
}) {
  const t = useTranslations("social");
  const [text, setText] = useState("");
  const [target, setTarget] = useState<PostView>(targets[0] ?? "bridge");
  const remaining = 1000 - text.length;
  return (
    <div className="border-t border-border p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 1000))}
        rows={3}
        placeholder={t("quotePlaceholder")}
        className="w-full resize-none rounded-lg border border-border-input p-2.5 text-sm outline-none focus:border-primary"
        autoFocus
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {targets.length > 1 && (
          <div className="flex gap-1" role="radiogroup" aria-label={t("quoteTarget")}>
            {targets.map((tg) => (
              <button
                key={tg}
                type="button"
                role="radio"
                aria-checked={target === tg}
                onClick={() => setTarget(tg)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${target === tg ? "bg-primary-soft text-chip-ink" : "bg-surface-2 text-ink-soft"}`}
              >
                {t(`repostTo.${tg}`)}
              </button>
            ))}
          </div>
        )}
        <span className="ml-auto text-xs tabular-nums text-ink-soft">{remaining}</span>
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-ink-soft hover:bg-surface-2">
          {t("cancel")}
        </button>
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => onSubmit(text, target)}
          className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-40"
        >
          {t("postQuote")}
        </button>
      </div>
    </div>
  );
}
