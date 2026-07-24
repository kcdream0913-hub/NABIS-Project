"use client";
import type { ReactNode } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react"; // npm i @formkit/auto-animate
import PostCard, { type FeedPost } from "./PostCard";

/**
 * Feed — the client list that renders PostCards with smooth add/remove. Data is
 * fetched by the caller (the feed page) and passed in; do NOT move data-fetching
 * here. `renderAction` lets the caller inject a per-post affordance (the Report
 * button) into each card's header. The empty state is handled by the caller, so
 * this only renders when there are posts.
 */
export default function Feed({
  posts,
  locale,
  renderAction,
}: {
  posts: FeedPost[];
  locale: string;
  renderAction?: (post: FeedPost) => ReactNode;
}) {
  const [ref] = useAutoAnimate<HTMLDivElement>();
  return (
    <div ref={ref} className="mx-auto flex max-w-xl flex-col gap-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} locale={locale} action={renderAction?.(p)} />
      ))}
    </div>
  );
}
