"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Compass, HandHeart, Inbox, PenSquare } from "lucide-react";
import PostCard from "@/components/PostCard";
import EmptyState from "@/components/EmptyState";
import { EVENTS, MEMBERS, VIEW_META, formatEventDate, initials } from "@/lib/data";
import { useApp } from "@/lib/store";

export default function HomePage() {
  const { view, posts } = useApp();
  const meta = VIEW_META[view];
  const feed = posts.filter((p) => p.view === view);
  const nextEvents = EVENTS.filter((e) => e.view === view || e.view === "bridge").slice(0, 2);
  const newMembers = MEMBERS.slice(0, 3);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
      <div className="min-w-0">
        <p className="eyebrow text-ink-soft">{meta.label}</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Home</h1>
        <p className="mt-1 text-sm text-ink-soft">{meta.blurb}</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Link href="/create?section=welcome" className="group rounded-lg border border-line bg-white p-4 hover:border-pine">
            <HandHeart size={18} className="text-pine" />
            <p className="mt-2 text-sm font-semibold">Introduce yourself</p>
            <p className="mt-0.5 text-xs text-ink-soft">Every intro gets read here.</p>
          </Link>
          <Link href="/create" className="group rounded-lg border border-line bg-white p-4 hover:border-pine">
            <PenSquare size={18} className="text-pine" />
            <p className="mt-2 text-sm font-semibold">Create a post</p>
            <p className="mt-0.5 text-xs text-ink-soft">Share an opportunity or ask.</p>
          </Link>
          <Link href="/events" className="group rounded-lg border border-line bg-white p-4 hover:border-pine">
            <CalendarDays size={18} className="text-pine" />
            <p className="mt-2 text-sm font-semibold">Upcoming events</p>
            <p className="mt-0.5 text-xs text-ink-soft">{EVENTS.length} on the calendar.</p>
          </Link>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-lg border border-pine-soft bg-pine-soft/50 px-4 py-3">
          <p className="text-sm"><span className="font-semibold">New here?</span> A five-minute onboarding sets up your profile and default view.</p>
          <Link href="/onboarding" className="flex shrink-0 items-center gap-1 text-sm font-medium text-pine hover:text-pine-ink">
            Start <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {feed.length === 0 ? (
            <EmptyState
              icon={Compass}
              title={`Quiet in ${meta.label} so far`}
              body="Be the first to post here, or switch views to see what the rest of the corridor is discussing."
              actionHref="/create"
              actionLabel="Create the first post"
            />
          ) : (
            feed.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      </div>

      <aside className="hidden space-y-5 xl:block">
        <section className="rounded-lg border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Next events</h2>
            <Link href="/events" className="text-xs font-medium text-pine hover:text-pine-ink">All</Link>
          </div>
          <ul className="mt-3 space-y-3">
            {nextEvents.map((e) => {
              const d = formatEventDate(e.date);
              return (
                <li key={e.id} className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-mist text-center">
                    <span>
                      <span className="eyebrow block text-[9px] text-rhodo">{d.month}</span>
                      <span className="block text-sm font-bold leading-none">{d.day}</span>
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{e.title}</span>
                    <span className="block text-xs text-ink-soft">{e.location}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-lg border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">New members</h2>
            <Link href="/members" className="text-xs font-medium text-pine hover:text-pine-ink">Directory</Link>
          </div>
          <ul className="mt-3 space-y-3">
            {newMembers.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-pine-soft text-xs font-bold text-pine">{initials(m.name)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{m.name}</span>
                  <span className="block truncate text-xs text-ink-soft">{m.role} · {m.location}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-line bg-white p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Inbox size={14} className="text-pine" /> Invite standing</h2>
          <p className="mt-2 text-sm text-ink-soft">3 of your 5 invites remain. Bring in people you would vouch for.</p>
          <Link href="/profile" className="mt-3 inline-block text-xs font-medium text-pine hover:text-pine-ink">Get your invite link</Link>
        </section>
      </aside>
    </div>
  );
}
