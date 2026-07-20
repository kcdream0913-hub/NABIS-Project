"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { MEMBERS, SECTIONS, VIEW_META, initials } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { View } from "@/lib/types";

const STEPS = ["Welcome", "Profile", "Your view", "Guidelines", "Introduce", "Follow"] as const;

const GUIDELINES = [
  "Be specific. Real asks and real offers — this is a working room, not a broadcast channel.",
  "Vouch carefully. Invites are limited because every member reflects on the people who brought them in.",
  "Keep deals honest. Misrepresenting a business or listing gets one warning, then removal.",
  "Respect both sides of the corridor. Two countries, one community.",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { view, setView, addPost } = useApp();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Business Owner");
  const [location, setLocation] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [intro, setIntro] = useState("");
  const [follows, setFollows] = useState<Set<string>>(new Set());

  const canNext =
    step === 1 ? name.trim().length > 0 :
    step === 3 ? agreed :
    true;

  const finish = () => {
    if (intro.trim()) addPost({ authorId: "me", section: "welcome", view, body: intro.trim() });
    router.push("/community");
  };

  const toggleFollow = (id: string) =>
    setFollows((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow text-ink-soft">Getting started</p>
          <p className="text-xs text-ink-soft">Step {step + 1} of {STEPS.length}</p>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-pine transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white p-6">
        {step === 0 && (
          <div>
            <h1 className="text-xl font-semibold tracking-tight">You&apos;re in. Welcome to BridgeLink.</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              This is an invite-only network of business owners, entrepreneurs, and investors working
              across the US–Nepal corridor. Small on purpose, useful on purpose. Five quick steps and
              you&apos;ll be set up.
            </p>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Set up your profile</h1>
            <p className="mt-1 text-sm text-ink-soft">This is how members decide to reply to you. Real names work best here.</p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="eyebrow text-ink-soft">Full name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine" />
              </label>
              <label className="block text-sm">
                <span className="eyebrow text-ink-soft">Role</span>
                <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm">
                  {["Business Owner", "Entrepreneur", "Investor", "Creator", "Professional"].map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="eyebrow text-ink-soft">Location</span>
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, country"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine" />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Choose your default view</h1>
            <p className="mt-1 text-sm text-ink-soft">BridgeLink opens here every time. Switch any time from the top bar.</p>
            <div className="mt-4 space-y-2">
              {(Object.keys(VIEW_META) as View[]).map((v) => {
                const m = VIEW_META[v];
                const active = v === view;
                return (
                  <button key={v} onClick={() => setView(v)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${active ? "border-pine bg-pine-soft/50" : "border-line hover:bg-mist"}`}>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.dot}`} />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{m.label}</span>
                      <span className="block text-xs text-ink-soft">{m.blurb}</span>
                    </span>
                    {active ? <Check size={16} className="text-pine" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-lg font-semibold tracking-tight">How this room works</h1>
            <ul className="mt-3 space-y-2.5">
              {GUIDELINES.map((g, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-pine-soft text-[10px] font-bold text-pine">{i + 1}</span>
                  {g}
                </li>
              ))}
            </ul>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4 accent-pine" />
              I&apos;ve read these and I&apos;m in.
            </label>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Introduce yourself</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Posted to the Welcome section when you finish. Who you are, what you run, what you&apos;re looking for.
            </p>
            <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={5}
              placeholder="Namaste — I run…"
              className="mt-3 w-full resize-y rounded-md border border-line px-3 py-2 text-sm leading-relaxed placeholder:text-ink-soft focus:border-pine" />
            <p className="mt-2 text-xs text-ink-soft">Optional, but members who introduce themselves get replies on day one.</p>
          </div>
        )}

        {step === 5 && (
          <div>
            <h1 className="text-lg font-semibold tracking-tight">People and rooms to start with</h1>
            <p className="mt-1 text-sm text-ink-soft">A few members and sections that match most new arrivals.</p>
            <div className="mt-3 space-y-2">
              {MEMBERS.slice(0, 3).map((m) => (
                <button key={m.id} onClick={() => toggleFollow(m.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left ${follows.has(m.id) ? "border-pine bg-pine-soft/50" : "border-line hover:bg-mist"}`}>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-pine-soft text-xs font-bold text-pine">{initials(m.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{m.name}</span>
                    <span className="block truncate text-xs text-ink-soft">{m.role} · {m.location}</span>
                  </span>
                  {follows.has(m.id) ? <Check size={15} className="text-pine" /> : <span className="text-xs font-medium text-pine">Follow</span>}
                </button>
              ))}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SECTIONS.slice(1, 5).map((s) => (
                  <button key={s.slug} onClick={() => toggleFollow(s.slug)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${follows.has(s.slug) ? "border-pine bg-pine-soft text-pine-ink" : "border-line text-ink-soft hover:bg-mist"}`}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
          className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-white disabled:opacity-0">
          <ArrowLeft size={15} /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep((s) => s + 1)} disabled={!canNext}
            className="flex items-center gap-1 rounded-md bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-ink disabled:opacity-40">
            Continue <ArrowRight size={15} />
          </button>
        ) : (
          <button onClick={finish} className="rounded-md bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-ink">
            Enter BridgeLink
          </button>
        )}
      </div>
    </div>
  );
}
