"use client";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import Avatar from "./Avatar";
import TrustBadge from "./TrustBadge";
import { ViewChip } from "./chips";
import { ReactionBar } from "./ReactionBar";
import { trustTier } from "@/lib/trust";
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/formatRelativeTime";
import type { BodyLang } from "@/lib/detectLang";
import { resolvePostDisplay } from "@/lib/postTranslation";

export interface FeedPost {
  id: string; body: string; created_at: string;
  view: "us" | "nepal" | "bridge"; posted_as: "user" | "business";
  // Auto-translation: source language + a single cached machine translation.
  bodyLang: BodyLang; bodyTranslated?: string | null; bodyTranslatedLang?: BodyLang | null;
  author: { id: string; name: string; avatar_url?: string | null; verification_status: "verified" | "unverified"; tier?: "bridge" };
  business?: { id: string; name: string; logo_url?: string | null; verification_status: "verified" | "unverified"; tier?: "bridge" } | null;
  likeCount?: number; commentCount?: number; likedByMe?: boolean;
}

export default function PostCard({ post, locale, action }: { post: FeedPost; locale: string; action?: ReactNode }) {
  const t = useTranslations("feed");
  const tCommon = useTranslations("common");
  const biz = post.posted_as === "business" && post.business ? post.business : null;
  const who = biz ?? post.author;
  const avatarUrl = biz ? biz.logo_url : post.author.avatar_url;

  // Reconciled to the repo's TrustBadge (tier: TrustTier + label). A business
  // has no corridor tier, so it resolves to "verified" at most.
  const tier = trustTier({ verification_status: who.verification_status, bridge: who.tier === "bridge" });
  const label = biz
    ? tCommon("verifiedBusiness")
    : tCommon(tier === "bridge" ? "bridgeVerified" : "verified");

  // Auto-translation. If the viewer reads the other language, show a translation
  // with a subtle "Auto-translated" tag and a See-original toggle. Seed from the
  // cached row; if absent, fetch it on demand and swap in — never blocking render.
  const [translation, setTranslation] = useState<string | null>(
    post.bodyTranslated && post.bodyTranslatedLang === locale ? post.bodyTranslated : null
  );
  const [showOriginal, setShowOriginal] = useState(false);
  const display = resolvePostDisplay({ body: post.body, bodyLang: post.bodyLang, viewerLocale: locale, translation, showOriginal });

  useEffect(() => {
    if (!display.needsTranslation || translation) return;
    let cancelled = false;
    fetch("/api/posts/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postId: post.id }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.translated) setTranslation(d.translated); })
      .catch(() => { /* leave the original showing — translation never blocks the feed */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display.needsTranslation, translation, post.id, locale]);

  return (
    <article className="card card-hover overflow-hidden">
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
            <time dateTime={post.created_at} title={formatAbsoluteTime(post.created_at, locale)} className="tabular-nums text-[13px] text-ink-soft">
              {formatRelativeTime(post.created_at, locale)}
            </time>
          </div>
        </div>
        {action}
      </header>

      <div className="px-4 pb-4">
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
      </div>

      <ReactionBar postId={post.id} initialLiked={post.likedByMe} likeCount={post.likeCount} commentCount={post.commentCount} />
    </article>
  );
}
