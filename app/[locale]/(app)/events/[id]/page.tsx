"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CalendarPlus, Check, MapPin, Users, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Link } from "@/i18n/navigation";
import Avatar from "@/components/Avatar";
import TrustBadge from "@/components/TrustBadge";
import { trustTier } from "@/lib/trust";
import { readPreferences } from "@/lib/preferences";
import { buildIcs, googleCalendarUrl, type CalendarEvent } from "@/lib/calendar";

type Host = { id: string; name: string | null; avatar_url: string | null; verification_status: string | null; bridge: boolean | null };
type Attendee = { id: string; name: string | null; avatar_url: string | null };
type EventRow = {
  id: string; title: string; date: string | null; time: string | null;
  starts_at: string | null; ends_at: string | null; event_tz: string | null;
  mode: string | null; location: string | null; view: string | null; description: string | null;
  host_id: string | null; profiles: Host | Host[] | null;
};

function formatWhen(e: EventRow, tz: string, locale: string): string {
  if (!e.starts_at) return `${e.date ?? ""}${e.time ? ` · ${e.time}` : ""}`;
  const opts: Intl.DateTimeFormatOptions = {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  };
  try {
    return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { ...opts, timeZone: tz }).format(new Date(e.starts_at));
  } catch {
    return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, opts).format(new Date(e.starts_at));
  }
}

export default function EventDetailPage() {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const supabase = createClient();
  const id = String(useParams().id);

  const [event, setEvent] = useState<EventRow | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [count, setCount] = useState(0);
  const [going, setGoing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tz, setTz] = useState("America/New_York");
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const { data: ev } = await supabase
        .from("events")
        .select("id, title, date, time, starts_at, ends_at, event_tz, mode, location, view, description, host_id, profiles:host_id ( id, name, avatar_url, verification_status, bridge )")
        .eq("id", id)
        .single();
      if (!ev) {
        setState("missing");
        return;
      }
      setEvent(ev as EventRow);

      const { data: rsvps } = await supabase
        .from("rsvps")
        .select("user_id, profiles:user_id ( id, name, avatar_url )")
        .eq("event_id", id);
      setCount((rsvps ?? []).length);
      setAttendees(
        (rsvps ?? [])
          .map((r) => (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles))
          .filter((p): p is Attendee => !!p),
      );
      if (user) setGoing((rsvps ?? []).some((r) => r.user_id === user.id));

      if (user) {
        const { data: profile } = await supabase.from("profiles").select("preferences").eq("id", user.id).single();
        setTz(readPreferences(profile?.preferences).timezone);
      }
      setState("ok");
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggleRsvp() {
    if (!userId || !event) return;
    if (going) {
      await supabase.from("rsvps").delete().eq("user_id", userId).eq("event_id", event.id);
      setGoing(false);
      setCount((c) => Math.max(0, c - 1));
      setAttendees((prev) => prev.filter((a) => a.id !== userId));
    } else {
      await supabase.from("rsvps").insert({ user_id: userId, event_id: event.id });
      setGoing(true);
      setCount((c) => c + 1);
    }
  }

  function calendarEvent(e: EventRow): CalendarEvent {
    return {
      id: e.id, title: e.title, description: e.description, location: e.location,
      startsAt: e.starts_at, endsAt: e.ends_at,
    };
  }

  function downloadIcs() {
    if (!event) return;
    const blob = new Blob([buildIcs(calendarEvent(event))], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.title.replace(/[^\w-]+/g, "_").slice(0, 40) || "event"}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (state === "loading") return <p className="p-6 text-sm text-ink-soft">{t("loading")}</p>;
  if (state === "missing" || !event)
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-soft">{t("notFound")}</p>
        <Link href="/events" className="mt-3 inline-block text-sm text-primary hover:underline">{t("backToEvents")}</Link>
      </div>
    );

  const host = Array.isArray(event.profiles) ? event.profiles[0] : event.profiles;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/events" className="text-sm text-ink-soft hover:text-ink">← {t("backToEvents")}</Link>

      <div className="mt-3 rounded-lg border border-border bg-surface p-5">
        <h1 className="text-xl font-semibold tracking-tight">{event.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          <span>{formatWhen(event, tz, locale)}</span>
          <span className="flex items-center gap-1">
            {event.mode === "online" ? <Video size={13} /> : <MapPin size={13} />} {event.location}
          </span>
          <span className="flex items-center gap-1">
            <Users size={13} /> {t("attendees", { count })}
          </span>
        </div>

        {event.description && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed">{event.description}</p>}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={toggleRsvp}
            disabled={!userId}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              going ? "border border-border text-ink hover:bg-bg" : "bg-primary text-on-primary hover:bg-primary-pressed"
            }`}
          >
            {going ? (
              <span className="flex items-center gap-1"><Check size={14} /> {t("cancelRsvp")}</span>
            ) : (
              t("rsvp")
            )}
          </button>
          <button onClick={downloadIcs} className="flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-bg">
            <CalendarPlus size={14} /> {t("addToCalendar")}
          </button>
          <a
            href={googleCalendarUrl(calendarEvent(event))}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-bg"
          >
            {t("googleCalendar")}
          </a>
        </div>
      </div>

      {/* Host */}
      {host && (
        <div className="mt-4">
          <p className="eyebrow text-ink-soft">{t("host")}</p>
          <Link href={`/people/${host.id}`} className="mt-1.5 flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:border-primary">
            <Avatar name={host.name} url={host.avatar_url} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-semibold">{host.name ?? t("member")}</p>
                <TrustBadge tier={trustTier(host)} label={tCommon(trustTier(host) === "bridge" ? "bridgeVerified" : "verified")} />
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Attendees */}
      {attendees.length > 0 && (
        <div className="mt-4">
          <p className="eyebrow text-ink-soft">{t("attendees", { count })}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {attendees.slice(0, 24).map((a) => (
              <Link key={a.id} href={`/people/${a.id}`} title={a.name ?? t("member")}>
                <Avatar name={a.name} url={a.avatar_url} size={32} />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
