"use client";
import type { ReactNode } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import PostCard, { type FeedPost } from "./PostCard";
import type { PostView } from "@/lib/feed/reposts";

/**
 * Feed — the client list that renders PostCards with smooth add/remove. Data is
 * fetched by the caller (the feed page) and passed in; do NOT move data-fetching
 * here. `renderAction` injects a per-post affordance (the Report button) into
 * each card's header. `currentView`/`userId` flow down to each card's action bar.
 */
export default function Feed({
  posts,
  locale,
  currentView,
  userId,
  renderAction,
}: {
  posts: FeedPost[];
  locale: string;
  currentView: PostView;
  userId: string | null;
  renderAction?: (post: FeedPost) => ReactNode;
}) {
  const [ref] = useAutoAnimate<HTMLDivElement>();
  return (
    <div ref={ref} className="mx-auto flex max-w-xl flex-col gap-4">
      {posts.map((p) => (
        <PostCard
          key={p.quote ? `q-${p.id}-${p.quote.by}` : p.reposter ? `r-${p.id}-${p.reposter.name}` : p.id}
          post={p}
          locale={locale}
          currentView={currentView}
          userId={userId}
          action={p.quote ? undefined : renderAction?.(p)}
        />
      ))}
    </div>
  );
}
