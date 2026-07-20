"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { THREADS, initials, memberById } from "@/lib/data";

export default function MessagesPage() {
  const [activeId, setActiveId] = useState(THREADS[0].id);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState<Record<string, { from: "me" | "them"; text: string }[]>>({});

  const thread = THREADS.find((t) => t.id === activeId)!;
  const other = memberById(thread.withId);
  const messages = [...thread.messages, ...(extra[activeId] ?? [])];

  const send = () => {
    const text = (drafts[activeId] ?? "").trim();
    if (!text) return;
    setExtra((prev) => ({ ...prev, [activeId]: [...(prev[activeId] ?? []), { from: "me", text }] }));
    setDrafts((prev) => ({ ...prev, [activeId]: "" }));
  };

  return (
    <div>
      <p className="eyebrow text-ink-soft">Inbox</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Messages</h1>
      <div className="mt-4 grid overflow-hidden rounded-lg border border-line bg-white md:grid-cols-[260px_1fr]">
        <aside className="border-b border-line md:border-b-0 md:border-r">
          {THREADS.map((t) => {
            const m = memberById(t.withId);
            const active = t.id === activeId;
            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={`flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 ${
                  active ? "bg-pine-soft/60" : "hover:bg-mist"
                }`}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pine-soft text-xs font-bold text-pine">
                  {initials(m.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{m.name}</span>
                  <span className="block truncate text-xs text-ink-soft">{t.snippet}</span>
                </span>
              </button>
            );
          })}
        </aside>

        <section className="flex min-h-[420px] flex-col">
          <header className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">{other.name}</p>
            <p className="text-xs text-ink-soft">{other.role} · {other.location}</p>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[75%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  m.from === "me" ? "bg-pine text-white" : "bg-mist"
                }`}>{m.text}</p>
              </div>
            ))}
          </div>
          <footer className="flex items-center gap-2 border-t border-line p-3">
            <input
              value={drafts[activeId] ?? ""}
              onChange={(e) => setDrafts((prev) => ({ ...prev, [activeId]: e.target.value }))}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder={`Message ${other.name.split(" ")[0]}`}
              className="flex-1 rounded-md border border-line bg-mist px-3 py-2 text-sm placeholder:text-ink-soft focus:border-pine focus:bg-white"
            />
            <button onClick={send} aria-label="Send message"
              className="grid h-9 w-9 place-items-center rounded-md bg-pine text-white hover:bg-pine-ink">
              <Send size={15} />
            </button>
          </footer>
        </section>
      </div>
      <p className="mt-2 text-xs text-ink-soft">Messages are local mock data in this build; delivery goes live with member accounts.</p>
    </div>
  );
}
