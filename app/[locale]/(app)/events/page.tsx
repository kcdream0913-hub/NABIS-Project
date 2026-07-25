"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Check, ChevronLeft, ChevronRight, MapPin, Video, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VIEW_META } from "@/lib/data";
import { readPreferences } from "@/lib/preferences";
import { buildMonthGrid } from "@/lib/calendar";
import type { View } from "@/lib/types";

type EventRow = {
  id: string;
  title: string;
  date: string | null;
  time: string | null;
  starts_at: string | null;
  event_tz: string | null;
  mode: string | null;
  location: string | null;
  view: string | null;
  description: string | null;
  host_id: string | null;
  profiles: { name: string | null } | { name: string | null }[] | null;
};

const VIEW_DOT: Record<View, string> = { us: "bg-view-us", nepal: "bg-view-nepal", bridge: "bg-view-bridge" };

// "When" line in the VIEWER's timezone (preferences.timezone), falling back to
// the event's own zone, then the viewer's local zone. Latin numerals platform-wide.
function formatWhen(e: EventRow, tz: string, locale: string): string {
  if (!e.starts_at) return `${e.date ?? ""}${e.time ? ` · ${e.time}` : ""}`;
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  };
  try {
    return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { ...opts, timeZone: tz || e.event_tz || undefined }).format(new Date(e.starts_at));
  } catch {
    return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, opts).format(new Date(e.starts_at));
  }
}

// The event's calendar day (YYYY-MM-DD) as seen in the viewer's timezone.
function dayKeyInTz(iso: string, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return iso.slice(0, 10);
  }
}

export default function EventsPage() {
  const t = useTranslations("events");
  const tView = useTranslations("view");
  const locale = useLocale();
  const supabase = createClient();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [rsvps, setRsvps] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [tz, setTz] = useState("America/New_York");
  const [mode, setMode] = useState<"list" | "month">("list");
  const [mineOnly, setMineOnly] = useState(false);
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const { data: ev } = await supabase
        .from("events")
        .select("id, title, date, time, starts_at, event_tz, mode, location, view, description, host_id, profiles:host_id ( name )")
        .order("starts_at", { ascending: true, nullsFirst: false })
        .order("date", { ascending: true });
      setEvents((ev as EventRow[] | null) ?? []);

      const { data: allRsvps } = await supabase.from("rsvps").select("event_id");
      const tally: Record<string, number> = {};
      for (const r of allRsvps ?? []) tally[r.event_id] = (tally[r.event_id] ?? 0) + 1;
      setCounts(tally);

      if (user) {
        const { data: mine } = await supabase.from("rsvps").select("event_id").eq("user_id", user.id);
        setRsvps(new Set((mine ?? []).map((r) => r.event_id)));
        const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).single();
        setTz(readPreferences(profile?.preferences).timezone);
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleRsvp(eventId: string) {
    if (!userId) return;
    if (rsvps.has(eventId)) {
      await supabase.from("rsvps").delete().eq("user_id", userId).eq("event_id", eventId);
      setRsvps((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
      setCounts((c) => ({ ...c, [eventId]: Math.max(0, (c[eventId] ?? 1) - 1) }));
    } else {
      await supabase.from("rsvps").insert({ user_id: userId, event_id: eventId });
      setRsvps((prev) => new Set(prev).add(eventId));
      setCounts((c) => ({ ...c, [eventId]: (c[eventId] ?? 0) + 1 }));
    }
  }

  const visible = useMemo(
    () => (mineOnly ? events.filter((e) => rsvps.has(e.id)) : events),
    [events, mineOnly, rsvps],
  );

  // Map YYYY-MM-DD → events (viewer tz) for the month grid.
  const byDay = useMemo(() => {
    const map: Record<string, EventRow[]> = {};
    for (const e of visible) {
      if (!e.starts_at) continue;
      const key = dayKeyInTz(e.starts_at, tz);
      (map[key] ??= []).push(e);
    }
    return map;
  }, [visible, tz]);

  const grid = useMemo(() => buildMonthGrid(cursor.y, cursor.m), [cursor]);
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const monthLabel = new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { month: "long", year: "numeric" }).format(new Date(Date.UTC(cursor.y, cursor.m, 1)));

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.y, c.m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  }

  return (
    <div className="max-w-3xl">
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-ink-soft">{t("subtitle")}</p>

      {/* Controls: list/month toggle + my-events filter */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {(["list", "month"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === m ? "bg-primary-soft text-primary-pressed" : "text-ink-soft"}`}
            >
              {t(m === "list" ? "viewList" : "viewMonth")}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-soft">
          <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} className="accent-primary" />
          {t("myEvents")}
        </label>
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-ink-soft">{t("loading")}</p>
      ) : mode === "list" ? (
        visible.length === 0 ? (
          <p className="mt-5 text-sm text-ink-soft">{mineOnly ? t("noMyEvents") : t("empty")}</p>
        ) : (
          <div className="mt-5 space-y-3">
            {visible.map((e) => {
              const going = rsvps.has(e.id);
              const host = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
              const chipView = e.view && e.view in VIEW_META ? (e.view as View) : null;
              return (
                <article key={e.id} className="flex gap-4 rounded-lg border border-border bg-surface p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/events/${e.id}`} className="text-sm font-semibold hover:text-primary">{e.title}</Link>
                      {chipView && (
                        <span className={`rounded px-1.5 py-0.5 text-meta font-semibold ${VIEW_META[chipView].chip}`}>{tView(`${chipView}Short`)}</span>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                      <span>{formatWhen(e, tz, locale)}</span>
                      <span className="flex items-center gap-1">
                        {e.mode === "online" ? <Video size={12} /> : <MapPin size={12} />} {e.location}
                      </span>
                      {host?.name && <span>· {t("hostedBy", { name: host.name })}</span>}
                      <span className="flex items-center gap-1"><Users size={12} /> {t("attendees", { count: counts[e.id] ?? 0 })}</span>
                    </p>
                    {e.description && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{e.description}</p>}
                    <Link href={`/events/${e.id}`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">{t("details")}</Link>
                  </div>
                  <button
                    onClick={() => toggleRsvp(e.id)}
                    disabled={!userId}
                    className={`h-fit shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      going ? "bg-primary text-on-primary" : "border border-border hover:bg-bg"
                    }`}
                  >
                    {going ? <span className="flex items-center gap-1"><Check size={14} /> {t("going")}</span> : t("rsvp")}
                  </button>
                </article>
              );
            })}
          </div>
        )
      ) : (
        /* Month grid */
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <button onClick={() => shiftMonth(-1)} aria-label={t("prevMonth")} className="rounded-md border border-border p-1.5 text-ink-soft hover:bg-bg"><ChevronLeft size={16} /></button>
            <p className="text-sm font-semibold">{monthLabel}</p>
            <button onClick={() => shiftMonth(1)} aria-label={t("nextMonth")} className="rounded-md border border-border p-1.5 text-ink-soft hover:bg-bg"><ChevronRight size={16} /></button>
          </div>
          <div className="mt-3 grid grid-cols-7 overflow-hidden rounded-lg border border-border bg-surface text-center">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
              <div key={d} className="border-b border-border py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{t(`dow.${i}`)}</div>
            ))}
            {grid.map((g) => {
              const dayEvents = byDay[g.key] ?? [];
              return (
                <div key={g.key} className={`min-h-[64px] border-b border-r border-border p-1 text-left last:border-r-0 ${g.inMonth ? "" : "bg-bg/50"}`}>
                  <span className={`inline-grid h-5 w-5 place-items-center rounded-full text-[11px] ${g.key === todayKey ? "bg-primary text-on-primary" : g.inMonth ? "text-ink" : "text-ink-soft/60"}`}>{g.d}</span>
                  <div className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 3).map((e) => {
                      const v = (e.view && e.view in VIEW_META ? (e.view as View) : "bridge");
                      return (
                        <Link key={e.id} href={`/events/${e.id}`} className="flex items-center gap-1 truncate rounded px-0.5 text-[10px] text-ink hover:bg-bg" title={e.title}>
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${VIEW_DOT[v]}`} />
                          <span className="truncate">{e.title}</span>
                        </Link>
                      );
                    })}
                    {dayEvents.length > 3 && <span className="px-0.5 text-[10px] text-ink-soft">+{dayEvents.length - 3}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
