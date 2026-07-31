"use client";

import { useTranslations } from "next-intl";
import { Minus, X } from "lucide-react";
import ThreadConversation from "@/components/ThreadConversation";

export type OpenChat = { threadId: string; name: string; minimized: boolean };

const POPUP_HEIGHT = "h-[420px]";
const POPUP_WIDTH = "w-80";

// D-076. Facebook-style floating chat stack, bottom-right, fixed to the
// viewport (not the Feed's own scroll container) so it stays put while the
// feed scrolls under it. Each open chat is the SAME ThreadConversation the
// full /messages page renders — just at a fixed popup height via its
// `heightClass` prop — so attachments, reactions, edit/delete, read-receipts,
// and the realtime subscription all work identically here; nothing
// chat-specific is reimplemented for the popup. The minimize/close controls
// are absolutely positioned over ThreadConversation's own header (on a small
// opaque backing) rather than adding a second header, so there is exactly one
// place the other person's name is rendered.
//
// The parent (Feed page) owns `chats` and caps it at MAX_OPEN_CHATS, evicting
// the oldest when a new thread is opened — deliberately smaller than real
// Facebook's stack, a Feed-only-scope tradeoff (see D-076 in CLAUDE.md).
export default function FloatingChatDock({
  chats,
  onClose,
  onToggleMinimize,
}: {
  chats: OpenChat[];
  onClose: (threadId: string) => void;
  onToggleMinimize: (threadId: string) => void;
}) {
  const t = useTranslations("messages");
  if (chats.length === 0) return null;

  return (
    <div className="fixed bottom-0 right-4 z-40 flex items-end gap-3">
      {chats.map((c) =>
        c.minimized ? (
          <div
            key={c.threadId}
            className="flex h-11 w-56 items-center justify-between rounded-t-lg border border-border bg-surface px-3 shadow-lg"
          >
            <button
              onClick={() => onToggleMinimize(c.threadId)}
              aria-label={t("expand")}
              className="min-w-0 flex-1 truncate text-left text-xs font-semibold"
            >
              {c.name}
            </button>
            <button
              onClick={() => onClose(c.threadId)}
              aria-label={t("close")}
              className="ml-2 shrink-0 rounded p-1 text-ink-soft hover:bg-bg"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div key={c.threadId} className={`relative ${POPUP_WIDTH} shadow-lg`}>
            <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-md bg-surface/95 px-0.5">
              <button
                onClick={() => onToggleMinimize(c.threadId)}
                aria-label={t("minimize")}
                className="rounded p-1 text-ink-soft hover:bg-bg"
              >
                <Minus size={14} />
              </button>
              <button
                onClick={() => onClose(c.threadId)}
                aria-label={t("close")}
                className="rounded p-1 text-ink-soft hover:bg-bg"
              >
                <X size={14} />
              </button>
            </div>
            <ThreadConversation threadId={c.threadId} heightClass={POPUP_HEIGHT} />
          </div>
        ),
      )}
    </div>
  );
}
