"use client";

import EventCard from "@/components/EventCard";
import { EVENTS } from "@/lib/data";

export default function EventsPage() {
  const sorted = [...EVENTS].sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="max-w-3xl">
      <p className="eyebrow text-ink-soft">Calendar</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Events</h1>
      <p className="mt-1 text-sm text-ink-soft">Online and in-person gatherings across the corridor. RSVP so hosts can plan.</p>
      <div className="mt-5 space-y-3">
        {sorted.map((e) => <EventCard key={e.id} event={e} />)}
      </div>
    </div>
  );
}
