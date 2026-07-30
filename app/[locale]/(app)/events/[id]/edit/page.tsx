"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import EventEditor, { type EventEditData } from "@/components/EventEditor";
import { readPreferences } from "@/lib/preferences";

// Edit route. RLS (events_update_host) is the real guard; the host_id check here is UX so a
// non-host sees a clean "not yours" message instead of a save that RLS silently rejects.
export default function EditEventPage() {
  const t = useTranslations("events");
  const supabase = createClient();
  const router = useRouter();
  const id = String(useParams().id);
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [event, setEvent] = useState<EventEditData | null>(null);
  const [businesses, setBusinesses] = useState<{ id: string; name: string }[]>([]);
  const [rsvpCount, setRsvpCount] = useState(0);
  const [tz, setTz] = useState("America/New_York");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: ev } = await supabase
        .from("events")
        .select("id, title, description, starts_at, ends_at, event_tz, mode, location, view, status, host_id, host_business_id")
        .eq("id", id)
        .single();
      if (!ev || ev.host_id !== user.id) {
        setState("denied");
        return;
      }
      setEvent(ev as EventEditData);

      const [{ count }, { data: biz }, { data: profile }] = await Promise.all([
        supabase.from("rsvps").select("*", { count: "exact", head: true }).eq("event_id", id),
        supabase.from("businesses").select("id, name").eq("owner_user_id", user.id).order("created_at", { ascending: true }),
        supabase.from("profiles").select("preferences").eq("id", user.id).single(),
      ]);
      setRsvpCount(count ?? 0);
      setBusinesses((biz as { id: string; name: string }[]) ?? []);
      setTz(readPreferences(profile?.preferences).timezone);
      setState("ok");
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (state === "loading") return <p className="p-6 text-sm text-ink-soft">{t("loading")}</p>;
  if (state === "denied" || !event)
    return (
      <div className="mx-auto max-w-xl p-6">
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-soft">{t("editDenied")}</p>
        <Link href="/events" className="mt-3 inline-block text-sm text-primary hover:underline">{t("backToEvents")}</Link>
      </div>
    );

  return <EventEditor mode="edit" event={event} hostBusinesses={businesses} defaultTz={tz} rsvpCount={rsvpCount} />;
}
