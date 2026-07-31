"use client";

import { useEffect, useId, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { buildThreadList, type Thread } from "@/lib/messaging";

const RAIL_LIMIT = 8;

// D-076. Compact "who I'm talking to" rail beside the Feed. Same data as the
// full /messages inbox — built via the SAME buildThreadList this component and
// /messages/page.tsx both call, so the two surfaces can't silently disagree on
// what's unread or what the preview text is — just fewer rows and no reading
// pane: clicking a thread opens it as a floating popup (FloatingChatDock)
// instead of navigating away from the feed. Feed-only per product decision;
// this does NOT replace /messages, which stays the full-featured inbox ("See
// all" links there).
export default function FeedMessenger({
  onOpenThread,
}: {
  onOpenThread: (threadId: string, name: string) => void;
}) {
  const t = useTranslations("messages");
  const format = useFormatter();
  const supabase = createClient();
  const channelId = useId();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) {
      setThreads([]);
      setLoading(false);
      return;
    }
    const { data: mine } = await supabase
      .from("direct_thread_participants")
      .select("thread_id, last_read_at")
      .eq("user_id", user.id);
    const threadIds = (mine ?? []).map((r) => r.thread_id);
    if (threadIds.length === 0) {
      setThreads([]);
      setLoading(false);
      return;
    }
    const [{ data: others }, { data: lastMsgs }] = await Promise.all([
      supabase
        .from("direct_thread_participants")
        .select("thread_id, profiles:user_id ( name )")
        .in("thread_id", threadIds)
        .neq("user_id", user.id),
      supabase
        .from("messages")
        .select("thread_id, body, sender_id, created_at, deleted_at, attachments")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false }),
    ]);
    const list = buildThreadList(mine ?? [], others ?? [], lastMsgs ?? [], user.id, {
      member: t("member"),
      deleted: t("deleted"),
      photo: t("photo"),
      document: t("document"),
    });
    setThreads(list.slice(0, RAIL_LIMIT));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live: a new message from someone else refreshes the rail immediately — same
  // "own channel per mounted instance" pattern (and the same reason: a shared
  // channel name breaks when this and the Sidebar badge are both mounted) as
  // the Sidebar's unread dot.
  useEffect(() => {
    const channel = supabase
      .channel(`feed-messenger-${channelId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as { sender_id: string };
        if (userId && row.sender_id !== userId) load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  function open(th: Thread) {
    setThreads((prev) => prev.map((x) => (x.id === th.id ? { ...x, unread: false } : x)));
    onOpenThread(th.id, th.otherName);
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{t("title")}</h2>
        <Link href="/messages" className="text-xs font-medium text-primary hover:text-primary-pressed">
          {t("seeAll")}
        </Link>
      </div>

      <div className="mt-2 space-y-1">
        {loading ? (
          <p className="px-1 py-4 text-xs text-ink-soft">{t("loading")}</p>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-2 py-6 text-center">
            <MessagesSquare size={18} className="text-ink-soft" />
            <p className="text-xs text-ink-soft">{t("emptyTitle")}</p>
          </div>
        ) : (
          threads.map((th) => (
            <button
              key={th.id}
              onClick={() => open(th)}
              className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-bg"
            >
              <span className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">
                {th.otherName.slice(0, 2).toUpperCase()}
                {th.unread && (
                  <span
                    className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-surface"
                    aria-label={t("unread")}
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-xs ${th.unread ? "font-semibold text-ink" : "font-medium"}`}>
                  {th.otherName}
                </span>
                {th.lastPreview && (
                  <span className={`block truncate text-[11px] ${th.unread ? "text-ink" : "text-ink-soft"}`}>
                    {th.lastPreview}
                  </span>
                )}
              </span>
              {th.lastAt && (
                <time dateTime={th.lastAt} className="shrink-0 text-[10px] text-ink-soft">
                  {format.relativeTime(new Date(th.lastAt))}
                </time>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
