"use client";

import { useState } from "react";
import { Heart, MessageCircle } from "lucide-react";
import type { Post } from "@/lib/types";
import { SECTIONS, VIEW_META, initials, memberById } from "@/lib/data";

export default function PostCard({ post }: { post: Post }) {
  const author = memberById(post.authorId);
  const meta = VIEW_META[post.view];
  const section = SECTIONS.find((s) => s.slug === post.section);
  const [liked, setLiked] = useState(false);

  return (
    <article className="rounded-lg border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pine-soft text-xs font-bold text-pine">
          {initials(author.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold">{author.name}</span>
            <span className="text-xs text-ink-soft">{author.role} · {author.location}</span>
            <span className="text-xs text-ink-soft">· {post.createdAt}</span>
            <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.chip}`}>{meta.short}</span>
          </div>
          {section ? <p className="eyebrow mt-1 text-ink-soft">{section.name}</p> : null}
          <p className="mt-2 text-sm leading-relaxed">{post.body}</p>
          <div className="mt-3 flex items-center gap-4 text-xs text-ink-soft">
            <button
              onClick={() => setLiked((v) => !v)}
              className={`flex items-center gap-1.5 rounded px-1 py-0.5 hover:text-ink ${liked ? "text-rhodo" : ""}`}
            >
              <Heart size={14} fill={liked ? "currentColor" : "none"} /> {post.likes + (liked ? 1 : 0)}
            </button>
            <span className="flex items-center gap-1.5">
              <MessageCircle size={14} /> {post.replies} replies
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
