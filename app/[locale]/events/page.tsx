"use client";

import { useEffect, useState } from "react";
import { Check, MapPin, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type EventRow = {
  id: string;
  title: string;
  date: string | null;
  time: string | null;
  mode: string | null;
  location: string | null;
  description: string | null;
};

export default function EventsPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [rsvps, setRsvps] = useState<Set<string>>(new Set());
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
        .select("id, title, date, time, mode, location, description")
        .order("date");
      setEvents(ev ?? []);

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
    } else {
      await supabase.from("rsvps").insert({ user_id: userId, event_id: eventId });
      setRsvps((prev) => new Set(prev).add(eventId));
    }
  }

  return (
    <div className="max-w-3xl">
      <p className="eyebrow text-ink-soft">Calendar</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Events</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Online and in-person gatherings across the corridor. RSVP so hosts can plan.
      </p>

      {loading ? (
        <p className="mt-5 text-sm text-ink-soft">Loading…</p>
      ) : events.length === 0 ? (
        <p className="mt-5 text-sm text-ink-soft">No events yet.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {events.map((e) => {
            const going = rsvps.has(e.id);
            return (
              <article key={e.id} className="flex gap-4 rounded-lg border border-line bg-white p-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{e.title}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
                    <span>{e.date}{e.time ? ` · ${e.time}` : ""}</span>
                    <span className="flex items-center gap-1">
                      {e.mode === "online" ? <Video size={12} /> : <MapPin size={12} />} {e.location}
                    </span>
                  </p>
                  {e.description && <p className="mt-2 text-sm text-ink-soft">{e.description}</p>}
                </div>
                <button
                  onClick={() => toggleRsvp(e.id)}
                  disabled={!userId}
                  className={`h-fit shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    going ? "bg-pine text-white" : "border border-line hover:bg-mist"
                  }`}
                >
                  {going ? (
                    <span className="flex items-center gap-1">
                      <Check size={14} /> Going
                    </span>
                  ) : (
                    "RSVP"
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
