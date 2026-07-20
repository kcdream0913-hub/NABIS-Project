"use client";

import { useState } from "react";
import Link from "next/link";
import { MessagesSquare, PenSquare } from "lucide-react";
import PostCard from "@/components/PostCard";
import EmptyState from "@/components/EmptyState";
import { SECTIONS } from "@/lib/data";
import { useApp } from "@/lib/store";

export default function CommunityPage() {
  const { posts } = useApp();
  const [active, setActive] = useState(SECTIONS[0].slug);
  const section = SECTIONS.find((s) => s.slug === active)!;
  const sectionPosts = posts.filter((p) => p.section === active);

  return (
    <div>
      <p className="eyebrow text-ink-soft">Community</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Sections</h1>
      <p className="mt-1 text-sm text-ink-soft">Structured rooms so busy people find the right conversation fast.</p>

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-line pb-px">
        {SECTIONS.map((s) => (
          <button
            key={s.slug}
            onClick={() => setActive(s.slug)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              s.slug === active ? "border-pine text-pine-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{section.name}</h2>
          <p className="text-xs text-ink-soft">{section.description}</p>
        </div>
        <Link
          href={`/create?section=${section.slug}`}
          className="flex items-center gap-1.5 rounded-md bg-pine px-3 py-1.5 text-sm font-medium text-white hover:bg-pine-ink"
        >
          <PenSquare size={14} /> Post in {section.name}
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {sectionPosts.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title={`Nothing in ${section.name} yet`}
            body="This room is waiting for its first thread. Sections with early activity set the tone for everyone who follows."
            actionHref={`/create?section=${section.slug}`}
            actionLabel="Start the first thread"
          />
        ) : (
          sectionPosts.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>
    </div>
  );
}
