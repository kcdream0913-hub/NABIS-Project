"use client";

import { EmojiPicker as Frimousse } from "frimousse";

// Full emoji picker (composer). Wrapped so it can be lazy-loaded via next/dynamic
// (ssr:false) — it never enters the thread bundle and only downloads when opened.
// Uses frimousse's default rendering (styled via classNames); labels are passed in
// so the host can localize (en/ne).
export default function EmojiPicker({
  onSelect,
  labels,
}: {
  onSelect: (emoji: string) => void;
  labels: { search: string; loading: string; empty: string };
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
      <Frimousse.Root
        onEmojiSelect={(e) => onSelect(e.emoji)}
        className="isolate flex h-[320px] w-[300px] flex-col [&_[data-frimousse-emoji]]:text-xl"
      >
        <Frimousse.Search
          placeholder={labels.search}
          className="m-2 rounded-md border border-border-input bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-primary"
        />
        <Frimousse.Viewport className="relative flex-1 outline-none">
          <Frimousse.Loading className="p-3 text-sm text-ink-soft">{labels.loading}</Frimousse.Loading>
          <Frimousse.Empty className="p-3 text-sm text-ink-soft">{labels.empty}</Frimousse.Empty>
          <Frimousse.List className="select-none px-1.5 pb-1.5" />
        </Frimousse.Viewport>
      </Frimousse.Root>
    </div>
  );
}
