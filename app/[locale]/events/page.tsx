"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, MapPin, Video, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { VIEW_META } from "@/lib/data";
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

// Explicit timezone-aware "when" line. Prefer the absolute instant rendered in
// the event's own IANA zone (with the zone name shown, so a US 6 PM and a Nepal
// 6 PM are never confused across the corridor); fall back to legacy date+time
// text for events created before starts_at existed. Latin numerals platform-wide.
function formatEventWhen(e: EventRow, locale: string): string {
  if (e.starts_at) {
    const base: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    };
    try {
      return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
        ...base,
        timeZone: e.event_tz ?? undefined,
      }).format(new Date(e.starts_at));
    } catch {
      // Unknown/invalid event_tz → render in the viewer's local zone.
      return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, base).format(new Date(e.starts_at));
    }
  }
  return `${e.date ?? ""}${e.time ? ` · ${e.time}` : ""}`;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const { data: ev } = await supabase
        .from("events")
        .select(
          "id, title, date, time, starts_at, event_tz, mode, location, view, description, host_id, profiles:host_id ( name )"
        )
        .order("starts_at", { ascending: true, nullsFirst: false })
        .order("date", { ascending: true });
      setEvents((ev as EventRow[] | null) ?? []);

      // Attendee proof: total RSVP count per event (rsvps are world-readable).
      const { data: allRsvps } = await supabase.from("rsvps").select("event_id");
      const tally: Record<string, number> = {};
      for (const r of allRsvps ?? []) tally[r.event_id] = (tally[r.event_id] ?? 0) + 1;
      setCounts(tally);

      if (user) {
        const { data: mine } = await supabase.from("rsvps").select("event_id").eq("user_id", user.id);
        setRsvps(new Set((mine ?? []).map((r) => r.event_id)));
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

  return (
    <div className="max-w-3xl">
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-ink-soft">{t("subtitle")}</p>

      {loading ? (
        <p className="mt-5 text-sm text-ink-soft">{t("loading")}</p>
      ) : events.length === 0 ? (
        <p className="mt-5 text-sm text-ink-soft">{t("empty")}</p>
      ) : (
        <div className="mt-5 space-y-3">
          {events.map((e) => {
            const going = rsvps.has(e.id);
            const host = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
            const chipView = e.view && e.view in VIEW_META ? (e.view as View) : null;
            return (
              <article key={e.id} className="flex gap-4 rounded-lg border border-border bg-white p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{e.title}</h3>
                    {chipView && (
                      <span className={`rounded px-1.5 py-0.5 text-meta font-semibold ${VIEW_META[chipView].chip}`}>
                        {tView(`${chipView}Short`)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                    <span>{formatEventWhen(e, locale)}</span>
                    <span className="flex items-center gap-1">
                      {e.mode === "online" ? <Video size={12} /> : <MapPin size={12} />} {e.location}
                    </span>
                    {host?.name && <span>· {t("hostedBy", { name: host.name })}</span>}
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {t("attendees", { count: counts[e.id] ?? 0 })}
                    </span>
                  </p>
                  {e.description && <p className="mt-2 text-sm text-ink-soft">{e.description}</p>}
                </div>
                <button
                  onClick={() => toggleRsvp(e.id)}
                  disabled={!userId}
                  className={`h-fit shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    going ? "bg-primary text-white" : "border border-border hover:bg-bg"
                  }`}
                >
                  {going ? (
                    <span className="flex items-center gap-1">
                      <Check size={14} /> {t("going")}
                    </span>
                  ) : (
                    t("rsvp")
                  )}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
