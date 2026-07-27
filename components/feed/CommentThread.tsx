"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import {
  canEditComment,
  canDeleteOwnComment,
  canModerateComment,
  canReplyTo,
  resolveParentId,
  isCommentBodyValid,
  isDeleted,
  COMMENT_MAX,
  COMMENT_COUNTER_AT,
  type PostComment,
} from "@/lib/feed/comments";

type Author = { name: string | null; avatar_url: string | null } | null;
type Row = PostComment & { profiles: Author | Author[] };

const TOP_PAGE = 10;

// BL-SOCIAL-02 §4.2 — inline comment thread. One level of replies, soft delete,
// 15-minute edit window (author) / remove-only (post author). Realtime is
// subscribed ONLY while the thread is open and torn down on unmount.
export default function CommentThread({
  postId,
  postAuthorId,
  onCountChange,
}: {
  postId: string;
  postAuthorId: string;
  onCountChange?: (n: number) => void;
}) {
  const t = useTranslations("social");
  const locale = useLocale();
  const supabase = createClient();

  const [rows, setRows] = useState<Row[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleTop, setVisibleTop] = useState(TOP_PAGE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("post_comments")
      .select("id, post_id, author_id, parent_comment_id, body, body_lang, created_at, edited_at, deleted_at, profiles:author_id ( name, avatar_url )")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    const list = (data as Row[] | null) ?? [];
    setRows(list);
    setLoading(false);
    onCountChange?.(list.filter((c) => !c.deleted_at).length);
  }, [postId, supabase, onCountChange]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    setNow(Date.now());
    load();
    // realtime only while open (§4.2)
    const channel = supabase
      .channel(`post-comments-${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const author = (r: Row): { name: string; avatar_url: string | null } => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return { name: p?.name ?? t("member"), avatar_url: p?.avatar_url ?? null };
  };

  const { topLevel, repliesByParent } = useMemo(() => {
    const top = rows.filter((r) => r.parent_comment_id === null);
    top.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)); // newest first
    const byParent = new Map<string, Row[]>();
    for (const r of rows) {
      if (r.parent_comment_id) {
        const arr = byParent.get(r.parent_comment_id) ?? [];
        arr.push(r);
        byParent.set(r.parent_comment_id, arr);
      }
    }
    for (const arr of byParent.values()) arr.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    return { topLevel: top, repliesByParent: byParent };
  }, [rows]);

  async function submit(body: string, parentId: string | null) {
    if (!userId || !isCommentBodyValid(body)) return;
    await supabase.from("post_comments").insert({
      post_id: postId,
      author_id: userId,
      parent_comment_id: parentId,
      body: body.trim(),
      body_lang: locale === "ne" ? "ne" : "en",
    });
    // realtime will reload; reload eagerly too so the author sees it instantly
    load();
  }

  async function saveEdit(id: string, body: string) {
    if (!isCommentBodyValid(body)) return;
    await supabase.from("post_comments").update({ body: body.trim() }).eq("id", id);
    load();
  }

  async function softDelete(id: string) {
    await supabase.from("post_comments").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  }

  return (
    <section className="border-t border-border px-4 py-3" aria-label={t("commentsSection")}>
      <Composer onSubmit={(b) => submit(b, null)} inputRef={composerRef} placeholder={t("commentPlaceholder")} submitLabel={t("commentSubmit")} />

      {loading ? (
        <p className="mt-3 text-sm text-ink-soft">{t("loading")}</p>
      ) : topLevel.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">{t("noComments")}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {topLevel.slice(0, visibleTop).map((c) => {
            const replies = repliesByParent.get(c.id) ?? [];
            const isOpen = expanded.has(c.id);
            return (
              <li key={c.id}>
                <CommentRow
                  row={c}
                  author={author(c)}
                  userId={userId}
                  postAuthorId={postAuthorId}
                  now={now}
                  locale={locale}
                  canReply
                  onReply={(body) => submit(body, resolveParentId(c))}
                  onSaveEdit={(body) => saveEdit(c.id, body)}
                  onDelete={() => softDelete(c.id)}
                />
                {replies.length > 0 && (
                  <div className="ml-11 mt-2">
                    {!isOpen ? (
                      <button
                        type="button"
                        onClick={() => setExpanded((s) => new Set(s).add(c.id))}
                        className="text-[13px] font-medium text-primary hover:text-primary-pressed"
                      >
                        {t("showReplies", { count: replies.length })}
                      </button>
                    ) : (
                      <ul className="space-y-3">
                        {replies.map((r) => (
                          <li key={r.id}>
                            <CommentRow
                              row={r}
                              author={author(r)}
                              userId={userId}
                              postAuthorId={postAuthorId}
                              now={now}
                              locale={locale}
                              canReply={false}
                              onSaveEdit={(body) => saveEdit(r.id, body)}
                              onDelete={() => softDelete(r.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {topLevel.length > visibleTop && (
            <li>
              <button
                type="button"
                onClick={() => setVisibleTop((v) => v + TOP_PAGE)}
                className="text-[13px] font-medium text-primary hover:text-primary-pressed"
              >
                {t("showMoreComments")}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function CommentRow({
  row,
  author,
  userId,
  postAuthorId,
  now,
  locale,
  canReply,
  onReply,
  onSaveEdit,
  onDelete,
}: {
  row: PostComment;
  author: { name: string; avatar_url: string | null };
  userId: string | null;
  postAuthorId: string;
  now: number;
  locale: string;
  canReply: boolean;
  onReply?: (body: string) => void;
  onSaveEdit: (body: string) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("social");
  const [editing, setEditing] = useState(false);
  const [replying, setReplying] = useState(false);

  if (isDeleted(row)) {
    return (
      <div className="flex items-start gap-2.5">
        <Avatar name="" url={null} size={32} />
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm italic text-ink-soft">{t("commentRemoved")}</p>
      </div>
    );
  }

  const mine = userId === row.author_id;
  const canEdit = userId ? canEditComment(row, userId, now) : false;
  const canDelete = userId ? canDeleteOwnComment(row, userId) : false;
  const canRemove = userId ? canModerateComment(row, postAuthorId, userId) : false;
  const replyOk = canReply && canReplyTo(row);

  return (
    <div className="flex items-start gap-2.5">
      <Avatar name={author.name} url={author.avatar_url} size={32} />
      <div className="min-w-0 flex-1">
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[13px] font-semibold text-ink">{author.name}</span>
            <time dateTime={row.created_at} className="text-[11px] text-ink-soft">{formatRelativeTime(row.created_at, locale)}</time>
            {row.edited_at && <span className="text-[11px] text-ink-soft">· {t("edited")}</span>}
          </div>
          {editing ? (
            <InlineEdit initial={row.body ?? ""} onCancel={() => setEditing(false)} onSave={(b) => { onSaveEdit(b); setEditing(false); }} />
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink" lang={row.body_lang ?? undefined}>{row.body}</p>
          )}
        </div>
        {!editing && (
          <div className="mt-1 flex flex-wrap items-center gap-3 pl-1 text-[12px] font-medium text-ink-soft">
            {replyOk && (
              <button type="button" onClick={() => setReplying((v) => !v)} className="hover:text-ink">{t("reply")}</button>
            )}
            {mine && canEdit && (
              <button type="button" onClick={() => setEditing(true)} className="hover:text-ink">{t("edit")}</button>
            )}
            {canDelete && (
              <button type="button" onClick={onDelete} className="hover:text-accent">{t("delete")}</button>
            )}
            {canRemove && (
              <button type="button" onClick={onDelete} className="hover:text-accent">{t("remove")}</button>
            )}
          </div>
        )}
        {replying && onReply && (
          <div className="mt-2">
            <Composer
              onSubmit={(b) => { onReply(b); setReplying(false); }}
              placeholder={t("replyPlaceholder")}
              submitLabel={t("reply")}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({
  onSubmit,
  placeholder,
  submitLabel,
  inputRef,
  compact,
}: {
  onSubmit: (body: string) => void;
  placeholder: string;
  submitLabel: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  compact?: boolean;
}) {
  const t = useTranslations("social");
  const [body, setBody] = useState("");
  const remaining = COMMENT_MAX - body.length;
  const valid = isCommentBodyValid(body);
  return (
    <div className={compact ? "" : "mt-1"}>
      <textarea
        ref={inputRef}
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, COMMENT_MAX))}
        rows={compact ? 2 : 2}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-border-input p-2.5 text-sm outline-none focus:border-primary"
      />
      <div className="mt-1 flex items-center justify-end gap-2">
        {body.length >= COMMENT_COUNTER_AT && (
          <span className={`text-xs tabular-nums ${remaining < 0 ? "text-accent" : "text-ink-soft"}`}>{remaining}</span>
        )}
        <button
          type="button"
          disabled={!valid}
          onClick={() => { onSubmit(body); setBody(""); }}
          className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-40"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function InlineEdit({ initial, onSave, onCancel }: { initial: string; onSave: (b: string) => void; onCancel: () => void }) {
  const t = useTranslations("social");
  const [body, setBody] = useState(initial);
  return (
    <div className="mt-1">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value.slice(0, COMMENT_MAX))}
        rows={2}
        autoFocus
        className="w-full resize-none rounded-lg border border-border-input p-2 text-sm outline-none focus:border-primary"
      />
      <div className="mt-1 flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1 text-sm text-ink-soft hover:bg-surface-2">{t("cancel")}</button>
        <button type="button" disabled={!isCommentBodyValid(body)} onClick={() => onSave(body)} className="rounded-md bg-primary px-3 py-1 text-sm font-medium text-on-primary disabled:opacity-40">{t("save")}</button>
      </div>
    </div>
  );
}
