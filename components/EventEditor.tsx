"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  EVENT_MODES,
  EVENT_VIEWS,
  zonedWallToUtcIso,
  utcIsoToZonedWall,
  validateEvent,
  type EventMode,
} from "@/lib/events";
import { TIMEZONE_GROUPS, ALL_ZONES, zoneLabel } from "@/lib/timezones";

const INPUT = "mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary";
const SELECT = "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm";
const LABEL = "eyebrow text-ink-soft";

export type EventEditData = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  event_tz: string | null;
  mode: string | null;
  location: string | null;
  view: string | null;
  status: string | null;
  host_business_id: string | null;
};

// Create/edit an event. host_id is always the human (auth.uid()); host_business_id is the
// optional org display identity (RLS requires the caller to OWN that business). starts_at/
// ends_at are stored as UTC instants derived from the wall-clock inputs + event_tz — the
// legacy events.date/events.time are NEVER written (scheduled for removal). Cancel sets
// status='cancelled' (RSVPs cascade on a hard delete, so we never delete a booked event);
// hard delete is offered only when rsvpCount === 0.
export default function EventEditor({
  mode,
  hostBusinesses,
  defaultTz,
  event,
  rsvpCount = 0,
}: {
  mode: "create" | "edit";
  hostBusinesses: { id: string; name: string }[];
  defaultTz: string;
  event?: EventEditData;
  rsvpCount?: number;
}) {
  const t = useTranslations("events");
  const router = useRouter();
  const supabase = createClient();

  const initialTz = event?.event_tz || defaultTz;
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [eventTz, setEventTz] = useState(initialTz);
  const [startsAt, setStartsAt] = useState(utcIsoToZonedWall(event?.starts_at, initialTz));
  const [endsAt, setEndsAt] = useState(utcIsoToZonedWall(event?.ends_at, initialTz));
  const [evMode, setEvMode] = useState<EventMode>(event?.mode === "online" ? "online" : "in_person");
  const [location, setLocation] = useState(event?.location ?? "");
  const [view, setView] = useState(event?.view ?? "");
  const [hostAs, setHostAs] = useState(event?.host_business_id ?? "");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show the selected zone in the picker even if it's outside the curated list.
  const extraZone = eventTz && !ALL_ZONES.includes(eventTz) ? eventTz : null;

  async function save() {
    setError(null);
    const problem = validateEvent({ title, view, startsAt, endsAt });
    if (problem) return setError(t(problem));
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      starts_at: zonedWallToUtcIso(startsAt, eventTz),
      ends_at: endsAt ? zonedWallToUtcIso(endsAt, eventTz) : null,
      event_tz: eventTz,
      mode: evMode,
      location: location.trim() || null,
      view,
      host_id: user.id,
      host_business_id: hostAs || null,
      // events.date / events.time are legacy — deliberately NEVER written.
    };

    if (mode === "edit" && event) {
      const { error: e } = await supabase.from("events").update(payload).eq("id", event.id);
      if (e) {
        setError(e.message);
        setSaving(false);
        return;
      }
      router.push(`/events/${event.id}`);
      return;
    }

    const { data, error: e } = await supabase.from("events").insert(payload).select("id").single();
    if (e || !data) {
      setError(e?.message ?? t("genericError"));
      setSaving(false);
      return;
    }
    router.push(`/events/${data.id}`);
  }

  async function cancelEvent() {
    if (!event || !confirm(t("confirmCancel"))) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.from("events").update({ status: "cancelled" }).eq("id", event.id);
    if (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    router.push(`/events/${event.id}`);
  }

  async function hardDelete() {
    if (!event || !confirm(t("confirmDelete"))) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.from("events").delete().eq("id", event.id);
    if (e) {
      setError(e.message);
      setBusy(false);
      return;
    }
    router.push("/events");
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow text-ink-soft">{t("editorEyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{mode === "edit" ? t("editTitle") : t("newTitle")}</h1>
      <p className="mt-1 text-sm text-ink-soft">{t("editorSubtitle")}</p>

      <div className="mt-5 space-y-3 rounded-lg border border-border bg-surface p-4">
        <label className="block text-sm">
          <span className={LABEL}>{t("fieldTitle")}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
        </label>

        <label className="block text-sm">
          <span className={LABEL}>{t("fieldDescription")}</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={INPUT} />
        </label>

        {hostBusinesses.length > 0 && (
          <label className="block text-sm">
            <span className={LABEL}>{t("fieldHostAs")}</span>
            <select value={hostAs} onChange={(e) => setHostAs(e.target.value)} className={SELECT}>
              <option value="">{t("hostAsMyself")}</option>
              {hostBusinesses.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-ink-soft">{t("fieldHostAsHint")}</span>
          </label>
        )}

        <label className="block text-sm">
          <span className={LABEL}>{t("fieldTimezone")}</span>
          <select value={eventTz} onChange={(e) => setEventTz(e.target.value)} className={SELECT}>
            {extraZone && <option value={extraZone}>{zoneLabel(extraZone)}</option>}
            {TIMEZONE_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.zones.map((z) => (
                  <option key={z} value={z}>{zoneLabel(z)}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <span className="mt-1 block text-xs text-ink-soft">{t("fieldTimezoneHint")}</span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={LABEL}>{t("fieldStartsAt")}</span>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={INPUT} />
          </label>
          <label className="block text-sm">
            <span className={LABEL}>{t("fieldEndsAt")}</span>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={INPUT} />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={LABEL}>{t("fieldMode")}</span>
            <select value={evMode} onChange={(e) => setEvMode(e.target.value as EventMode)} className={SELECT}>
              {EVENT_MODES.map((m) => (
                <option key={m} value={m}>{t(`mode.${m}`)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className={LABEL}>{t("fieldView")}</span>
            <select value={view} onChange={(e) => setView(e.target.value)} className={SELECT}>
              <option value="">{t("viewSelect")}</option>
              {EVENT_VIEWS.map((v) => (
                <option key={v} value={v}>{t(`view.${v}`)}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className={LABEL}>{t("fieldLocation")}</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t(evMode === "online" ? "fieldLocationOnline" : "fieldLocationInPerson")} className={INPUT} />
        </label>

        {error && <p className="text-sm text-accent" role="alert">{error}</p>}

        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50"
        >
          {saving ? t("saving") : mode === "edit" ? t("saveChanges") : t("createEvent")}
        </button>
      </div>

      {/* Edit-only destructive actions. Cancel keeps RSVPs (a hard delete would cascade
          them away); hard delete is offered ONLY for an event nobody has RSVP'd to. */}
      {mode === "edit" && event && event.status !== "cancelled" && (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
          <p className="eyebrow text-ink-soft">{t("dangerZone")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={cancelEvent}
              disabled={busy}
              className="rounded-md border border-accent px-3.5 py-2 text-sm font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {t("cancelEvent")}
            </button>
            {rsvpCount === 0 && (
              <button
                onClick={hardDelete}
                disabled={busy}
                className="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-bg disabled:opacity-50"
              >
                {t("deleteEvent")}
              </button>
            )}
          </div>
          <p className="text-xs text-ink-soft">{rsvpCount === 0 ? t("dangerHintNoRsvp") : t("dangerHintHasRsvp", { count: rsvpCount })}</p>
        </div>
      )}
    </div>
  );
}
