"use client";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Languages, Repeat2 } from "lucide-react";
import Avatar from "./Avatar";
import TrustBadge from "./TrustBadge";
import { ViewChip } from "./chips";
import { Link } from "@/i18n/navigation";
import PostActionBar, { type ActionInitial } from "./feed/PostActionBar";
import CommentThread from "./feed/CommentThread";
import PostMedia from "./feed/PostMedia";
import { trustTier } from "@/lib/trust";
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/formatRelativeTime";
import { postPermalink } from "@/lib/feed/share";
import type { PostView } from "@/lib/feed/reposts";
import type { ReactionKind } from "@/lib/feed/reactions";
import type { PostMedia as PostMediaItem } from "@/lib/feed/media";
import type { BodyLang } from "@/lib/detectLang";
import { resolvePostDisplay } from "@/lib/postTranslation";

export interface FeedPost {
  id: string; body: string; created_at: string;
  view: PostView; posted_as: "user" | "business";
  bodyLang: BodyLang; bodyTranslated?: string | null; bodyTranslatedLang?: BodyLang | null;
  author: { id: string; name: string; avatar_url?: string | null; verification_status: "verified" | "unverified"; tier?: "bridge" };
  business?: { id: string; name: string; logo_url?: string | null; verification_status: "verified" | "unverified"; tier?: "bridge" } | null;
  media: PostMediaItem[];
  mediaUrls: Record<string, string>;
  // social action seeds
  reactionCounts: Partial<Record<ReactionKind, number>>;
  myReaction: ReactionKind | null;
  commentCount: number;
  repostCount: number;
  myRepostView: PostView | null;
  bookmarked: boolean;
  // feed decorations
  reposter?: { name: string } | null;
  quote?: { text: string; by: string; lang: BodyLang | null } | null;
}

export default function PostCard({
  post,
  locale,
  currentView,
  userId,
  action,
  embedded = false,
  defaultCommentsOpen = false,
}: {
  post: FeedPost;
  locale: string;
  currentView?: PostView;
  userId?: string | null;
  action?: ReactNode;
  embedded?: boolean;
  defaultCommentsOpen?: boolean;
}) {
  const t = useTranslations("feed");
  const tSocial = useTranslations("social");
  const tCommon = useTranslations("common");
  const biz = post.posted_as === "business" && post.business ? post.business : null;
  const who = biz ?? post.author;
  const avatarUrl = biz ? biz.logo_url : post.author.avatar_url;

  const tier = trustTier({ verification_status: who.verification_status, bridge: who.tier === "bridge" });
  const label = biz
    ? tCommon("verifiedBusiness")
    : tCommon(tier === "bridge" ? "bridgeVerified" : "verified");

  const [translation, setTranslation] = useState<string | null>(
    post.bodyTranslated && post.bodyTranslatedLang === locale ? post.bodyTranslated : null
  );
  const [showOriginal, setShowOriginal] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(defaultCommentsOpen);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const display = resolvePostDisplay({ body: post.body, bodyLang: post.bodyLang, viewerLocale: locale, translation, showOriginal });

  useEffect(() => {
    if (embedded || !display.needsTranslation || translation) return;
    let cancelled = false;
    fetch("/api/posts/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId: post.id }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.translated) setTranslation(d.translated); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display.needsTranslation, translation, post.id, locale]);

  const permalink = typeof window !== "undefined" ? postPermalink(window.location.origin, post.id) : `/posts/${post.id}`;

  // ── Quote repost: quoter's text above a non-interactive embedded original ──
  if (post.quote && !embedded) {
    return (
      <article className="card overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 pt-3 text-[13px] text-ink-soft">
          <Repeat2 size={14} /> <span className="font-medium">{tSocial("quotedBy", { name: post.quote.by })}</span>
        </div>
        <p className="whitespace-pre-wrap break-words px-4 pb-3 pt-2 text-[15px] leading-relaxed text-ink" lang={post.quote.lang ?? undefined}>
          {post.quote.text}
        </p>
        <div className="mx-4 mb-4">
          <Link href={`/posts/${post.id}`} className="block rounded-lg border border-border p-3 hover:bg-surface-2">
            <EmbeddedOriginal post={post} locale={locale} />
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="card card-hover overflow-hidden">
      {post.reposter && (
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-2 text-[13px] text-ink-soft">
          <Repeat2 size={14} /> <span className="font-medium">{tSocial("repostedBy", { name: post.reposter.name })}</span>
        </div>
      )}
      <header className="flex items-start gap-3 p-4">
        <Avatar name={who.name} url={avatarUrl} size={44} shape={biz ? "rounded" : "circle"} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">{who.name}</span>
            <TrustBadge tier={tier} label={label} />
          </div>
          {biz && <span className="block truncate text-[13px] text-ink-soft">{t("postedBy", { name: post.author.name })}</span>}
          <div className="mt-0.5 flex items-center gap-2">
            <ViewChip view={post.view} />
            <span aria-hidden className="text-ink-soft">·</span>
            <Link href={`/posts/${post.id}`} className="tabular-nums text-[13px] text-ink-soft hover:underline">
              <time dateTime={post.created_at} title={formatAbsoluteTime(post.created_at, locale)}>
                {formatRelativeTime(post.created_at, locale)}
              </time>
            </Link>
          </div>
        </div>
        {action}
      </header>

      <div className="px-4 pb-1">
        <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-ink">{display.text}</div>
        {(display.isTranslated || display.canToggle) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            {display.isTranslated && (
              <span className="inline-flex items-center gap-1 text-ink-soft">
                <Languages size={12} aria-hidden /> {tCommon("autoTranslated")}
              </span>
            )}
            {display.canToggle && (
              <button type="button" onClick={() => setShowOriginal((v) => !v)} className="font-medium text-primary hover:text-primary-pressed">
                {display.showingOriginal ? t("showTranslation") : t("seeOriginal")}
              </button>
            )}
          </div>
        )}
        {post.media.length > 0 && <PostMedia media={post.media} urls={post.mediaUrls} />}
        <div className="pb-3" />
      </div>

      {!embedded && (
        <PostActionBar
          postId={post.id}
          postView={post.view}
          currentView={currentView ?? post.view}
          permalink={permalink}
          quoteText={post.body.slice(0, 140)}
          initialUserId={userId ?? null}
          commentsOpen={commentsOpen}
          onToggleComments={() => setCommentsOpen((v) => !v)}
          initial={{
            reactionCounts: post.reactionCounts,
            myReaction: post.myReaction,
            commentCount,
            repostCount: post.repostCount,
            myRepostView: post.myRepostView,
            bookmarked: post.bookmarked,
          } satisfies ActionInitial}
        />
      )}

      {!embedded && commentsOpen && (
        <CommentThread postId={post.id} postAuthorId={post.author.id} onCountChange={setCommentCount} />
      )}
    </article>
  );
}

// A compact, read-only copy of a post for embedding inside a quote repost.
function EmbeddedOriginal({ post, locale }: { post: FeedPost; locale: string }) {
  const biz = post.posted_as === "business" && post.business ? post.business : null;
  const who = biz ?? post.author;
  const avatarUrl = biz ? biz.logo_url : post.author.avatar_url;
  return (
    <div>
      <div className="flex items-center gap-2">
        <Avatar name={who.name} url={avatarUrl} size={28} shape={biz ? "rounded" : "circle"} />
        <span className="truncate text-[13px] font-semibold text-ink">{who.name}</span>
        <span aria-hidden className="text-ink-soft">·</span>
        <span className="text-[12px] text-ink-soft">{formatRelativeTime(post.created_at, locale)}</span>
      </div>
      <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap break-words text-[14px] text-ink">{post.body}</p>
      {post.media.length > 0 && <PostMedia media={post.media.slice(0, 1)} urls={post.mediaUrls} />}
    </div>
  );
}
