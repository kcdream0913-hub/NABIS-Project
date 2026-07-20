"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { CURRENT_USER, SECTIONS, VIEW_META, initials } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { View } from "@/lib/types";

export default function Composer() {
  const router = useRouter();
  const params = useSearchParams();
  const { view, addPost } = useApp();

  const initialSection = SECTIONS.some((s) => s.slug === params.get("section"))
    ? (params.get("section") as string)
    : SECTIONS[0].slug;

  const [section, setSection] = useState(initialSection);
  const [postView, setPostView] = useState<View>(view);
  const [body, setBody] = useState("");

  const publish = () => {
    if (!body.trim()) return;
    addPost({ authorId: "me", section, view: postView, body: body.trim() });
    router.push(section === "welcome" || section === SECTIONS[0].slug ? "/community" : "/");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <p className="eyebrow text-ink-soft">Composer</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Create a post</h1>
      <p className="mt-1 text-sm text-ink-soft">Pick the section it belongs in — that is how busy members find it.</p>

      <div className="mt-5 rounded-lg border border-line bg-white p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-pine-soft text-xs font-bold text-pine">
            {initials(CURRENT_USER.name)}
          </span>
          <div>
            <p className="text-sm font-semibold">{CURRENT_USER.name}</p>
            <p className="text-xs text-ink-soft">{CURRENT_USER.role}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow text-ink-soft">Section</span>
            <select value={section} onChange={(e) => setSection(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm">
              {SECTIONS.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow text-ink-soft">Audience</span>
            <select value={postView} onChange={(e) => setPostView(e.target.value as View)}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm">
              {(Object.keys(VIEW_META) as View[]).map((v) => (
                <option key={v} value={v}>{VIEW_META[v].label}</option>
              ))}
            </select>
          </label>
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="What should the network know? Specific asks get the best replies."
          className="mt-3 w-full resize-y rounded-md border border-line bg-white px-3 py-2 text-sm leading-relaxed placeholder:text-ink-soft focus:border-pine"
        />

        <div className="mt-3 flex items-center justify-between">
          <button
            disabled
            title="Image upload arrives with file storage — next build task"
            className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink-soft opacity-60"
          >
            <ImagePlus size={15} /> Add image
          </button>
          <button
            onClick={publish}
            disabled={!body.trim()}
            className="rounded-md bg-pine px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pine-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
