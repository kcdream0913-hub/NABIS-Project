"use client";

import { Check, MapPin, Video } from "lucide-react";
import type { EventItem } from "@/lib/types";
import { VIEW_META, formatEventDate } from "@/lib/data";
import { useApp } from "@/lib/store";

export default function EventCard({ event }: { event: EventItem }) {
  const { rsvps, toggleRsvp } = useApp();
  const going = rsvps.has(event.id);
  const d = formatEventDate(event.date);
  const meta = VIEW_META[event.view];

  return (
    <article className="flex gap-4 rounded-lg border border-line bg-white p-4">
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md border border-line bg-mist text-center">
        <div>
          <p className="eyebrow text-rhodo">{d.month}</p>
          <p className="text-lg font-bold leading-none">{d.day}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{event.title}</h3>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.chip}`}>{meta.short}</span>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
          <span>{event.time}</span>
          <span className="flex items-center gap-1">
            {event.mode === "Online" ? <Video size={12} /> : <MapPin size={12} />} {event.location}
          </span>
        </p>
        <p className="mt-2 text-sm text-ink-soft">{event.description}</p>
      </div>
      <button
        onClick={() => toggleRsvp(event.id)}
        className={`h-fit shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          going ? "bg-pine text-white" : "border border-line hover:bg-mist"
        }`}
      >
        {going ? <span className="flex items-center gap-1"><Check size={14} /> Going</span> : "RSVP"}
      </button>
    </article>
  );
}
