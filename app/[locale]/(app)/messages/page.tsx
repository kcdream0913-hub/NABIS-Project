"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import EmptyState from "@/components/EmptyState";
import ThreadConversation from "@/components/ThreadConversation";
import { isUnread } from "@/lib/messaging";

type Thread = {
  id: string;
  otherName: string;
  lastBody: string | null;
  lastAt: string | null;
  unread: boolean;
};

// Standalone Messages inbox (own sidebar destination): thread list left,
// conversation right on desktop; stacked on mobile. DMs only — channels live
// under /channels.
export default function MessagesPage() {
  const t = useTranslations("messages");
  const format = useFormatter();
  const supabase = createClient();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
    const readMap: Record<string, string | null> = Object.fromEntries(
      (mine ?? []).map((r) => [r.thread_id, r.last_read_at])
    );
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
        .select("thread_id, body, sender_id, created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false }),
    ]);
    const latest: Record<string, { body: string; sender_id: string; created_at: string }> = {};
    for (const m of lastMsgs ?? []) if (!latest[m.thread_id]) latest[m.thread_id] = m;
    const list: Thread[] = (others ?? []).map((o) => {
      const p = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
      const lm = latest[o.thread_id];
      return {
        id: o.thread_id,
        otherName: p?.name ?? t("member"),
        lastBody: lm?.body ?? null,
        lastAt: lm?.created_at ?? null,
        unread: isUnread(lm, readMap[o.thread_id], user.id),
      };
    });
    list.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));
    setThreads(list);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>

      {loading ? (
        <p className="mt-5 text-sm text-ink-soft">{t("loading")}</p>
      ) : threads.length === 0 ? (
        <div className="mt-5">
          <EmptyState icon={MessagesSquare} title={t("emptyTitle")} body={t("emptyBody")} />
        </div>
      ) : (
        <div className="mt-4 lg:grid lg:grid-cols-[300px_1fr] lg:gap-4">
          {/* Left: thread list (full width on mobile until a thread opens) */}
          <div className={`${selected ? "hidden lg:block" : "block"} space-y-2`}>
            {threads.map((th) => (
              <button
                key={th.id}
                onClick={() => {
                  setSelected(th.id);
                  setThreads((prev) => prev.map((x) => (x.id === th.id ? { ...x, unread: false } : x)));
                }}
                className={`flex w-full items-center gap-3 rounded-lg border bg-surface p-3 text-left hover:border-primary ${
                  selected === th.id ? "border-primary" : "border-border"
                }`}
              >
                <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                  {th.otherName.slice(0, 2).toUpperCase()}
                  {th.unread && (
                    <span
                      className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface"
                      aria-label={t("unread")}
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${th.unread ? "font-semibold text-ink" : "font-medium"}`}>
                      {th.otherName}
                    </span>
                    {th.lastAt && (
                      <time dateTime={th.lastAt} className="shrink-0 text-[11px] text-ink-soft">
                        {format.relativeTime(new Date(th.lastAt))}
                      </time>
                    )}
                  </span>
                  {th.lastBody && (
                    <span className={`mt-0.5 block truncate text-xs ${th.unread ? "text-ink" : "text-ink-soft"}`}>
                      {th.lastBody}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Right: the selected conversation (placeholder on desktop) */}
          <div className={`${selected ? "block" : "hidden lg:block"} mt-4 lg:mt-0`}>
            {selected ? (
              <ThreadConversation threadId={selected} onBack={() => setSelected(null)} />
            ) : (
              <div className="hidden min-h-[300px] place-items-center rounded-lg border border-dashed border-border p-6 text-center text-sm text-ink-soft lg:grid">
                {t("selectConversation")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
