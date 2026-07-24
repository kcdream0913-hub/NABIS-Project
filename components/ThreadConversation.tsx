"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { ArrowLeft, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Message = { id: string; sender_id: string; body: string; created_at: string };

// Reusable DM conversation: realtime, send, per-message timestamps, and it
// marks the thread read for the current user on open (scoped self-update on
// direct_thread_participants.last_read_at — RLS + trigger enforce that only
// last_read_at can change). Used by /messages/[id] and the two-pane inbox.
export default function ThreadConversation({
  threadId,
  onBack,
}: {
  threadId: string;
  onBack?: () => void;
}) {
  const t = useTranslations("thread");
  const format = useFormatter();
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherName, setOtherName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;
      setUserId(user.id);

      const { data: participants } = await supabase
        .from("direct_thread_participants")
        .select("user_id, profiles:user_id ( name )")
        .eq("thread_id", threadId);
      const other = (participants ?? []).find((p) => p.user_id !== user.id);
      const otherProfile = Array.isArray(other?.profiles) ? other?.profiles[0] : other?.profiles;
      if (active) setOtherName(otherProfile?.name ?? "");

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, sender_id, body, created_at")
        .eq("thread_id", threadId)
        .order("created_at");
      if (active) {
        setMessages(msgs ?? []);
        setLoading(false);
      }

      // Mark read for the current user (only last_read_at is mutable — pinned by trigger).
      await supabase
        .from("direct_thread_participants")
        .update({ last_read_at: new Date().toISOString() })
        .eq("thread_id", threadId)
        .eq("user_id", user.id);
    }
    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  async function send() {
    const text = draft.trim();
    if (!text || !userId) return;
    setDraft("");
    await supabase.from("messages").insert({ thread_id: threadId, sender_id: userId, body: text });
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-lg border border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        {onBack && (
          <button
            onClick={onBack}
            aria-label={t("back")}
            className="-ml-1 rounded p-1 text-ink-soft hover:bg-bg lg:hidden"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        <p className="text-sm font-semibold">{otherName || t("conversation")}</p>
      </header>

      {loading ? (
        <p className="p-4 text-sm text-ink-soft">{t("loading")}</p>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m) => {
            const mine = m.sender_id === userId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                <p
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    mine ? "bg-primary text-on-primary" : "bg-bg"
                  }`}
                >
                  {m.body}
                </p>
                <time dateTime={m.created_at} className="mt-0.5 px-1 text-[11px] text-ink-soft">
                  {format.dateTime(new Date(m.created_at), { hour: "numeric", minute: "2-digit" })}
                </time>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      <footer className="flex items-center gap-2 border-t border-border p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder={t("messagePrefix", { name: (otherName || t("member")).split(" ")[0] })}
          className="flex-1 rounded-md border border-border-input bg-bg px-3 py-2 text-sm placeholder:text-ink-soft focus:border-primary focus:bg-surface"
        />
        <button
          onClick={send}
          aria-label={t("sendMessage")}
          className="grid h-9 w-9 place-items-center rounded-md bg-primary text-on-primary hover:bg-primary-pressed"
        >
          <Send size={15} />
        </button>
      </footer>
    </div>
  );
}
