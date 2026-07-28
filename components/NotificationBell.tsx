"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import Avatar from "./Avatar";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import {
  unreadCount,
  badgeLabel,
  notificationHref,
  notificationLabelKey,
  type NotificationRow,
} from "@/lib/notifications";

type Actor = { id: string; name: string; avatar_url: string | null };
type Row = NotificationRow & { actor: Actor | null };

// BL-NOTIF-01 §B2 — the ACTIVITY bell (reactions/comments/replies/reposts). This
// is the ONLY consumer of the notifications table; the MESSAGES badge is separate
// (Sidebar, from last_read_at). Two sources, never unified (design decision).
export default function NotificationBell({ labelClass = "" }: { labelClass?: string }) {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const supabase = createClient();
  const router = useRouter();
  // Unique per instance: the rail is mounted twice on mobile (hidden rail +
  // drawer). A fixed realtime channel name would collide on the second .on()
  // and throw — same fix as the DM subscription (1ad28d9).
  const channelId = useId();

  const [uid, setUid] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const count = unreadCount(rows);
  const badge = badgeLabel(count);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUid(user.id);
    // RLS scopes this to my own rows (recipient = me).
    const { data } = await supabase
      .from("notifications")
      .select("id, recipient_id, actor_id, type, post_id, comment_id, view, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(20);
    const list = (data ?? []) as NotificationRow[];
    // One join for actor profiles (the row stores references only, never names).
    const actorIds = [...new Set(list.map((r) => r.actor_id).filter(Boolean))] as string[];
    let actors: Record<string, Actor> = {};
    if (actorIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, name, avatar_url").in("id", actorIds);
      actors = Object.fromEntries((profs ?? []).map((p) => [p.id, p as Actor]));
    }
    setRows(list.map((r) => ({ ...r, actor: r.actor_id ? actors[r.actor_id] ?? null : null })));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live: a new notification for me pushes into the badge/panel. Filtered to my
  // recipient_id (RLS also scopes it, the filter just avoids waking on others').
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`notif-${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${uid}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Close the panel on Escape (focus back to the bell) or an outside press.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  async function openRow(r: Row) {
    setOpen(false);
    if (!r.read_at) {
      const now = new Date().toISOString();
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, read_at: now } : x)));
      await supabase.from("notifications").update({ read_at: now }).eq("id", r.id);
    }
    router.push(notificationHref(r));
  }

  async function markAll() {
    if (!uid) return;
    const unread = rows.filter((r) => !r.read_at);
    if (unread.length === 0) return;
    const now = new Date().toISOString();
    setRows((prev) => prev.map((r) => (r.read_at ? r : { ...r, read_at: now })));
    await supabase.from("notifications").update({ read_at: now }).is("read_at", null).eq("recipient_id", uid);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={badge ? t("bellAriaCount", { count }) : t("bellAria")}
        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <span className="relative shrink-0">
          <Bell size={21} strokeWidth={1.9} />
          {badge && (
            <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-on-accent ring-2 ring-surface">
              {badge}
            </span>
          )}
        </span>
        <span className={labelClass}>{t("bell")}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("panelTitle")}
          className="absolute left-full top-0 z-50 ml-2 max-h-[70vh] w-80 overflow-y-auto rounded-xl border border-border bg-surface shadow-raised"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold text-ink">{t("panelTitle")}</span>
            {count > 0 && (
              <button type="button" onClick={markAll} className="text-xs font-medium text-primary hover:text-primary-pressed">
                {t("markAllRead")}
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-soft">{t("empty")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => openRow(r)}
                    className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-surface-2 ${
                      r.read_at ? "" : "bg-primary-soft/40"
                    }`}
                  >
                    <Avatar name={r.actor?.name ?? t("someone")} url={r.actor?.avatar_url ?? null} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] leading-snug text-ink">
                        <span className="font-semibold">{r.actor?.name ?? t("someone")}</span>{" "}
                        {t(notificationLabelKey(r.type))}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-soft">{formatRelativeTime(r.created_at, locale)}</span>
                    </span>
                    {!r.read_at && <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
