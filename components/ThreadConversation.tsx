"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useFormatter, useTranslations } from "next-intl";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CornerUpLeft,
  Paperclip,
  Pencil,
  Send,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import ErrorBoundary from "@/components/ErrorBoundary";
import AttachmentView from "@/components/AttachmentView";
import {
  type Attachment,
  type ChatMessage,
  canDeleteForEveryone,
  canDeleteForMe,
  canEditMessage,
  isSeenByOthers,
  messagePreview,
  truncateQuote,
} from "@/lib/messaging";
import { ACCEPT, ATTACHMENT_BUCKET, uploadAttachment, validateFile } from "@/lib/attachments";

const EmojiPicker = dynamic(() => import("@/components/EmojiPicker"), { ssr: false });

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏"];
const PAGE = 30;

type Row = {
  id: string;
  thread_id: string | null;
  sender_id: string;
  body: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  reply_to_message_id: string | null;
  attachments: Attachment[] | null;
};

function toMessage(r: Row): ChatMessage {
  return {
    id: r.id,
    thread_id: r.thread_id,
    sender_id: r.sender_id,
    body: r.body,
    created_at: r.created_at,
    edited_at: r.edited_at,
    deleted_at: r.deleted_at,
    reply_to_message_id: r.reply_to_message_id,
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
  };
}

const SELECT = "id, thread_id, sender_id, body, created_at, edited_at, deleted_at, reply_to_message_id, attachments";

function ThreadConversationInner({
  threadId,
  onBack,
  initialDraft = "",
}: {
  threadId: string;
  onBack?: () => void;
  initialDraft?: string;
}) {
  const t = useTranslations("thread");
  const format = useFormatter();
  const supabase = useMemo(() => createClient(), []);
  const channelId = useId();

  const [userId, setUserId] = useState<string | null>(null);
  const [otherId, setOtherId] = useState<string | null>(null);
  const [otherName, setOtherName] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<Record<string, Record<string, string>>>({});
  const [hides, setHides] = useState<Set<string>>(new Set());
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [typing, setTyping] = useState(false);

  // composer
  const [draft, setDraft] = useState(initialDraft);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [staged, setStaged] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // per-message UI
  const [activeMsg, setActiveMsg] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [reactPickerFor, setReactPickerFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const msgRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastTypingSent = useRef(0);
  const markedRef = useRef<string>("");
  const fileInput = useRef<HTMLInputElement>(null);
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = useMemo(() => messages.filter((m) => !hides.has(m.id)), [messages, hides]);
  const byId = useMemo(() => {
    const m: Record<string, ChatMessage> = {};
    for (const x of messages) m[x.id] = x;
    return m;
  }, [messages]);

  const loadReactions = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const { data } = await supabase.from("message_reactions").select("message_id, user_id, emoji").in("message_id", ids);
      setReactions((prev) => {
        const next = { ...prev };
        for (const r of (data ?? []) as { message_id: string; user_id: string; emoji: string }[]) {
          next[r.message_id] = { ...(next[r.message_id] ?? {}), [r.user_id]: r.emoji };
        }
        return next;
      });
    },
    [supabase],
  );

  // ── initial load ──
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;
      setUserId(user.id);

      const { data: parts } = await supabase
        .from("direct_thread_participants")
        .select("user_id, last_read_at, profiles:user_id ( name )")
        .eq("thread_id", threadId);
      const other = (parts ?? []).find((p: { user_id: string }) => p.user_id !== user.id) as
        | { user_id: string; last_read_at: string | null; profiles: { name: string } | { name: string }[] }
        | undefined;
      if (other) {
        setOtherId(other.user_id);
        const prof = Array.isArray(other.profiles) ? other.profiles[0] : other.profiles;
        setOtherName(prof?.name ?? "");
        setOtherReadAt(other.last_read_at);
      }

      const { data: rows } = await supabase
        .from("messages")
        .select(SELECT)
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(PAGE);
      const list = ((rows ?? []) as Row[]).map(toMessage).reverse();
      if (!active) return;
      setMessages(list);
      setHasMore((rows ?? []).length === PAGE);

      const { data: myHides } = await supabase.from("message_hides").select("message_id").eq("user_id", user.id);
      if (active) setHides(new Set(((myHides ?? []) as { message_id: string }[]).map((h) => h.message_id)));

      await loadReactions(list.map((m) => m.id));
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // scroll to bottom on new messages (only if near bottom already)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visible.length]);

  // ── mark read when visible + focused ──
  const markRead = useCallback(async () => {
    if (!userId) return;
    if (typeof document !== "undefined" && (document.visibilityState !== "visible" || !document.hasFocus())) return;
    const last = messages[messages.length - 1];
    if (!last || last.sender_id === userId) return;
    if (markedRef.current >= last.created_at) return;
    markedRef.current = last.created_at;
    await supabase
      .from("direct_thread_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("thread_id", threadId)
      .eq("user_id", userId);
  }, [userId, messages, supabase, threadId]);

  useEffect(() => {
    markRead();
    const onFocus = () => markRead();
    const onVis = () => markRead();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [markRead]);

  // ── realtime ──
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`thread-${threadId}-${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const m = toMessage(payload.new as Row);
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const m = toMessage(payload.new as Row);
          setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload) => {
        const row = (payload.new ?? payload.old) as { message_id: string; user_id: string; emoji?: string };
        if (!row) return;
        setReactions((prev) => {
          const mid = row.message_id;
          const cur = { ...(prev[mid] ?? {}) };
          if (payload.eventType === "DELETE") delete cur[row.user_id];
          else if (row.emoji) cur[row.user_id] = row.emoji;
          return { ...prev, [mid]: cur };
        });
      })
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "direct_thread_participants", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row = payload.new as { user_id: string; last_read_at: string | null };
          if (row.user_id !== userId) setOtherReadAt(row.last_read_at);
        },
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if ((payload as { userId: string }).userId === userId) return;
        setTyping(true);
        window.clearTimeout((channel as unknown as { _typ?: number })._typ);
        (channel as unknown as { _typ?: number })._typ = window.setTimeout(() => setTyping(false), 3000);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, userId]);

  // mark read whenever a new foreign message lands while we're looking
  useEffect(() => {
    markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  async function loadEarlier() {
    const oldest = messages[0];
    if (!oldest) return;
    const { data: rows } = await supabase
      .from("messages")
      .select(SELECT)
      .eq("thread_id", threadId)
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    const older = ((rows ?? []) as Row[]).map(toMessage).reverse();
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    setMessages((prev) => [...older, ...prev]);
    setHasMore((rows ?? []).length === PAGE);
    await loadReactions(older.map((m) => m.id));
    // keep scroll anchored
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevHeight;
    });
  }

  // ── composer actions ──
  function broadcastTyping() {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId } });
  }

  async function onPickFiles(files: FileList | null) {
    if (!files || !userId) return;
    setComposerError(null);
    for (const file of Array.from(files)) {
      const check = validateFile(file);
      if (!check.ok) {
        setComposerError(check.reason === "type" ? t("unsupportedType") : t("tooLarge"));
        continue;
      }
      setUploading(true);
      try {
        const att = await uploadAttachment(supabase, threadId, userId, file);
        setStaged((prev) => [...prev, att]);
      } catch {
        setComposerError(t("uploadFailed"));
      } finally {
        setUploading(false);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  async function removeStaged(att: Attachment) {
    setStaged((prev) => prev.filter((a) => a.path !== att.path));
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([att.path]);
  }

  async function send() {
    const text = draft.trim();
    if ((!text && staged.length === 0) || !userId) return;
    setDraft("");
    const payload = {
      thread_id: threadId,
      sender_id: userId,
      body: text || null,
      attachments: staged,
      reply_to_message_id: replyTo?.id ?? null,
    };
    setReplyTo(null);
    setStaged([]);
    const { data, error } = await supabase.from("messages").insert(payload).select(SELECT).single();
    if (!error && data) {
      const m = toMessage(data as Row);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const text = editing.text.trim();
    const target = byId[editing.id];
    setEditing(null);
    if (!text || !target || text === target.body) return;
    // optimistic
    setMessages((prev) => prev.map((x) => (x.id === target.id ? { ...x, body: text, edited_at: new Date().toISOString() } : x)));
    const { error } = await supabase.rpc("edit_message", { p_id: target.id, p_body: text });
    if (error) setMessages((prev) => prev.map((x) => (x.id === target.id ? target : x)));
  }

  async function deleteForEveryone(m: ChatMessage) {
    setMenuFor(null);
    // remove storage objects first (uploader owns the DELETE policy)
    const paths = m.attachments.map((a) => a.path);
    if (paths.length) await supabase.storage.from(ATTACHMENT_BUCKET).remove(paths);
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, body: null, attachments: [], deleted_at: new Date().toISOString() } : x)));
    const { error } = await supabase.rpc("delete_message_for_everyone", { p_id: m.id });
    if (error) setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
  }

  async function deleteForMe(m: ChatMessage) {
    setMenuFor(null);
    setHides((prev) => new Set(prev).add(m.id));
    await supabase.from("message_hides").insert({ message_id: m.id, user_id: userId });
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!userId) return;
    setReactPickerFor(null);
    setActiveMsg(null);
    const mine = reactions[messageId]?.[userId];
    setReactions((prev) => {
      const cur = { ...(prev[messageId] ?? {}) };
      if (mine === emoji) delete cur[userId];
      else cur[userId] = emoji;
      return { ...prev, [messageId]: cur };
    });
    if (mine === emoji) {
      await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", userId);
    } else {
      await supabase.from("message_reactions").upsert({ message_id: messageId, user_id: userId, emoji }, { onConflict: "message_id,user_id" });
    }
  }

  function replyPreviewText(m: ChatMessage): string {
    return messagePreview(m, { deleted: t("deletedTombstone"), photo: t("photo"), document: t("document") });
  }

  const attLabels = { download: t("download"), unavailable: t("unavailable") };

  // ── render ──
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-lg border border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        {onBack && (
          <button onClick={onBack} aria-label={t("back")} className="-ml-1 rounded p-1 text-ink-soft hover:bg-bg lg:hidden">
            <ArrowLeft size={16} />
          </button>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{otherName || t("conversation")}</p>
          {typing && <p className="text-[11px] text-online">{t("typing", { name: (otherName || t("member")).split(" ")[0] })}</p>}
        </div>
      </header>

      {loading ? (
        <p className="p-4 text-sm text-ink-soft">{t("loading")}</p>
      ) : (
        <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto p-4">
          {hasMore && (
            <div className="flex justify-center pb-2">
              <button onClick={loadEarlier} className="rounded-full border border-border px-3 py-1 text-xs text-ink-soft hover:bg-bg">
                {t("loadEarlier")}
              </button>
            </div>
          )}
          {visible.map((m) => {
            const mine = m.sender_id === userId;
            const tomb = !!m.deleted_at;
            const react = reactions[m.id] ?? {};
            const grouped = Object.entries(react).reduce<Record<string, number>>((acc, [, e]) => {
              acc[e] = (acc[e] ?? 0) + 1;
              return acc;
            }, {});
            const myReaction = userId ? react[userId] : undefined;
            const replied = m.reply_to_message_id ? byId[m.reply_to_message_id] : undefined;
            const seen = isSeenByOthers(m, userId ?? "", [otherReadAt]);

            return (
              <div
                key={m.id}
                ref={(el) => {
                  msgRefs.current[m.id] = el;
                }}
                className={`group flex flex-col ${mine ? "items-end" : "items-start"}`}
                onMouseEnter={() => !tomb && setActiveMsg(m.id)}
                onMouseLeave={() => {
                  setActiveMsg((cur) => (cur === m.id ? null : cur));
                }}
                onTouchStart={() => {
                  if (tomb) return;
                  longPress.current = setTimeout(() => setActiveMsg(m.id), 450);
                }}
                onTouchEnd={() => longPress.current && clearTimeout(longPress.current)}
              >
                {/* hover/long-press toolbar */}
                {activeMsg === m.id && !tomb && !editing && (
                  <div className={`relative z-10 mb-0.5 flex items-center gap-0.5 rounded-full border border-border bg-surface px-1 py-0.5 shadow-sm ${mine ? "self-end" : "self-start"}`}>
                    {QUICK_REACTIONS.map((e) => (
                      <button key={e} onClick={() => toggleReaction(m.id, e)} className="rounded-full px-1 text-base hover:bg-surface-2" aria-label={e}>
                        {e}
                      </button>
                    ))}
                    <button onClick={() => setReactPickerFor(reactPickerFor === m.id ? null : m.id)} aria-label={t("react")} className="rounded-full p-1 text-ink-soft hover:bg-surface-2">
                      <Smile size={15} />
                    </button>
                    <button onClick={() => { setReplyTo(m); setActiveMsg(null); }} aria-label={t("reply")} className="rounded-full p-1 text-ink-soft hover:bg-surface-2">
                      <CornerUpLeft size={15} />
                    </button>
                    {mine && (
                      <button onClick={() => setMenuFor(menuFor === m.id ? null : m.id)} aria-label={t("more")} className="rounded-full px-1.5 pb-1.5 text-ink-soft hover:bg-surface-2">
                        ⋯
                      </button>
                    )}
                  </div>
                )}

                {reactPickerFor === m.id && (
                  <div className="relative z-20 mb-1">
                    <EmojiPicker onSelect={(e) => toggleReaction(m.id, e)} labels={{ search: t("searchEmoji"), loading: t("emojiLoading"), empty: t("emojiEmpty") }} />
                  </div>
                )}

                {/* per-message action menu */}
                {menuFor === m.id && mine && !tomb && (
                  <div className="z-20 mb-1 w-44 self-end rounded-lg border border-border bg-surface py-1 text-sm shadow-lg">
                    {canEditMessage(m, userId ?? "", Date.now()) && (
                      <button onClick={() => { setEditing({ id: m.id, text: m.body ?? "" }); setMenuFor(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-2">
                        <Pencil size={14} /> {t("edit")}
                      </button>
                    )}
                    {canDeleteForEveryone(m, userId ?? "", Date.now()) && (
                      <button onClick={() => deleteForEveryone(m)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-accent hover:bg-surface-2">
                        <Trash2 size={14} /> {t("deleteForEveryone")}
                      </button>
                    )}
                    {canDeleteForMe(m) && (
                      <button onClick={() => deleteForMe(m)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-surface-2">
                        <Trash2 size={14} /> {t("deleteForMe")}
                      </button>
                    )}
                  </div>
                )}

                {/* bubble */}
                <div className={`max-w-[78%] rounded-lg px-3 py-2 text-sm leading-relaxed ${tomb ? "border border-dashed border-border bg-transparent italic text-ink-soft" : mine ? "bg-primary text-on-primary" : "bg-bg"}`}>
                  {tomb ? (
                    t("deletedTombstone")
                  ) : editing?.id === m.id ? (
                    <div className="flex flex-col gap-1">
                      <textarea
                        value={editing.text}
                        onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="w-56 rounded border border-border-input bg-surface p-1 text-ink"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex gap-2 text-xs">
                        <button onClick={saveEdit} className="font-semibold">{t("save")}</button>
                        <button onClick={() => setEditing(null)} className="text-ink-soft">{t("cancel")}</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {replied && (
                        <button
                          onClick={() => msgRefs.current[replied.id]?.scrollIntoView({ behavior: "smooth", block: "center" })}
                          className={`mb-1 block w-full border-l-2 pl-2 text-left text-xs ${mine ? "border-on-primary/50 text-on-primary/80" : "border-primary/50 text-ink-soft"}`}
                        >
                          {truncateQuote(replyPreviewText(replied))}
                        </button>
                      )}
                      {m.attachments.length > 0 && (
                        <div className="mb-1 flex flex-col gap-1.5">
                          {m.attachments.map((a) => (
                            <AttachmentView key={a.path} attachment={a} onOpenImage={(url, name) => setLightbox({ url, name })} labels={attLabels} />
                          ))}
                        </div>
                      )}
                      {m.body}
                    </>
                  )}
                </div>

                {/* reaction chips */}
                {Object.keys(grouped).length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {Object.entries(grouped).map(([e, count]) => (
                      <button
                        key={e}
                        onClick={() => toggleReaction(m.id, e)}
                        className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] ${myReaction === e ? "border-primary bg-primary-soft" : "border-border bg-surface"}`}
                      >
                        <span>{e}</span>
                        <span className="text-ink-soft">{count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* meta: time · edited · ticks */}
                <div className="mt-0.5 flex items-center gap-1 px-1 text-[11px] text-ink-soft">
                  <time dateTime={m.created_at}>{format.dateTime(new Date(m.created_at), { hour: "numeric", minute: "2-digit" })}</time>
                  {m.edited_at && !tomb && <span>· {t("edited")}</span>}
                  {mine && !tomb && (seen ? <CheckCheck size={13} className="text-online" aria-label={t("seen")} /> : <Check size={13} aria-label={t("sent")} />)}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* reply preview above composer */}
      {replyTo && (
        <div className="flex items-center gap-2 border-t border-border bg-bg px-3 py-2 text-xs">
          <CornerUpLeft size={14} className="text-ink-soft" />
          <span className="min-w-0 flex-1 truncate text-ink-soft">
            <span className="font-medium text-ink">{t("replyingTo")}</span> {truncateQuote(replyPreviewText(replyTo))}
          </span>
          <button onClick={() => setReplyTo(null)} aria-label={t("cancel")} className="text-ink-soft hover:text-ink">
            <X size={14} />
          </button>
        </div>
      )}

      {/* staged attachments */}
      {(staged.length > 0 || uploading) && (
        <div className="flex flex-wrap gap-2 border-t border-border bg-bg px-3 py-2">
          {staged.map((a) => (
            <span key={a.path} className="flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs">
              <span className="max-w-[140px] truncate">{a.name}</span>
              <button onClick={() => removeStaged(a)} aria-label={t("cancel")} className="text-ink-soft hover:text-accent">
                <X size={12} />
              </button>
            </span>
          ))}
          {uploading && <span className="text-xs text-ink-soft">…</span>}
        </div>
      )}
      {composerError && <p className="border-t border-border bg-bg px-3 py-1 text-xs text-accent" role="alert">{composerError}</p>}

      <footer className="relative flex items-center gap-2 border-t border-border p-3">
        <input ref={fileInput} type="file" accept={ACCEPT.join(",")} multiple hidden onChange={(e) => onPickFiles(e.target.files)} />
        <button onClick={() => fileInput.current?.click()} aria-label={t("attachFile")} className="shrink-0 rounded-md p-2 text-ink-soft hover:bg-bg hover:text-ink">
          <Paperclip size={18} />
        </button>
        <button onClick={() => setPickerOpen((v) => !v)} aria-label={t("emoji")} className="shrink-0 rounded-md p-2 text-ink-soft hover:bg-bg hover:text-ink">
          <Smile size={18} />
        </button>
        {pickerOpen && (
          <div className="absolute bottom-14 left-2 z-30">
            <EmojiPicker onSelect={(e) => { setDraft((d) => d + e); setPickerOpen(false); }} labels={{ search: t("searchEmoji"), loading: t("emojiLoading"), empty: t("emojiEmpty") }} />
          </div>
        )}
        <input
          value={draft}
          onChange={(e) => { setDraft(e.target.value); broadcastTyping(); }}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder={t("messagePrefix", { name: (otherName || t("member")).split(" ")[0] })}
          className="flex-1 rounded-md border border-border-input bg-bg px-3 py-2 text-sm placeholder:text-ink-soft focus:border-primary focus:bg-surface"
        />
        <button onClick={send} aria-label={t("sendMessage")} className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary text-on-primary hover:bg-primary-pressed">
          <Send size={15} />
        </button>
      </footer>

      {/* lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.url} alt={lightbox.name} className="max-h-full max-w-full rounded-lg" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setLightbox(null)} aria-label={t("cancel")} className="absolute right-4 top-4 rounded-full bg-surface/90 p-2 text-ink">
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

// Error boundary around the thread view so a render fault degrades to a message
// instead of blanking the app (mirrors the AppShell boundary).
export default function ThreadConversation(props: {
  threadId: string;
  onBack?: () => void;
  initialDraft?: string;
}) {
  return (
    <ErrorBoundary
      fallback={
        <div className="grid h-[calc(100vh-8rem)] place-items-center rounded-lg border border-border bg-surface p-6 text-center text-sm text-ink-soft">
          <ThreadError />
        </div>
      }
    >
      <ThreadConversationInner {...props} />
    </ErrorBoundary>
  );
}

function ThreadError() {
  const t = useTranslations("thread");
  return <p>{t("loadError")}</p>;
}
