"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import Avatar from "./Avatar";
import TrustBadge from "./TrustBadge";
import { ViewChip } from "./chips";
import { ReactionBar } from "./ReactionBar";
import { trustTier } from "@/lib/trust";
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/formatRelativeTime";

export interface FeedPost {
  id: string; body: string; created_at: string;
  view: "us" | "nepal" | "bridge"; posted_as: "user" | "business";
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

      <div className="whitespace-pre-wrap break-words px-4 pb-4 text-[15px] leading-relaxed text-ink">{post.body}</div>

      <ReactionBar postId={post.id} initialLiked={post.likedByMe} likeCount={post.likeCount} commentCount={post.commentCount} />
    </article>
  );
}
