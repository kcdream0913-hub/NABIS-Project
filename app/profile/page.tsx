"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { CURRENT_USER, VIEW_META, initials } from "@/lib/data";
import { useApp } from "@/lib/store";
import type { Role, View } from "@/lib/types";

const ROLES: Role[] = ["Business Owner", "Entrepreneur", "Investor", "Creator", "Professional"];
const INVITE_LINK = "https://bridgelink.app/invite/BL-7F3K9Q";

export default function ProfilePage() {
  const { view, setView } = useApp();
  const [name, setName] = useState(CURRENT_USER.name);
  const [role, setRole] = useState<Role>(CURRENT_USER.role);
  const [location, setLocation] = useState(CURRENT_USER.location);
  const [bio, setBio] = useState(CURRENT_USER.bio);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notif, setNotif] = useState({ replies: true, events: true, digest: false });

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(INVITE_LINK); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const toggle = (key: keyof typeof notif) => setNotif((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <p className="eyebrow text-ink-soft">Account</p>
        <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Profile &amp; settings</h1>
      </div>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="text-sm font-semibold">Profile</h2>
        <div className="mt-3 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-pine-soft text-sm font-bold text-pine">{initials(name || "?")}</span>
          <button className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-soft" disabled title="Photo upload arrives with file storage">
            Change photo
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="eyebrow text-ink-soft">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine" />
          </label>
          <label className="block text-sm">
            <span className="eyebrow text-ink-soft">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm">
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="eyebrow text-ink-soft">Location</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine" />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="eyebrow text-ink-soft">Bio</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine" />
          </label>
        </div>
        <button onClick={save} className="mt-3 rounded-md bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-ink">
          {saved ? "Saved" : "Save changes"}
        </button>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="text-sm font-semibold">Default view</h2>
        <p className="mt-1 text-xs text-ink-soft">Where BridgeLink opens for you. You can switch any time from the top bar.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {(Object.keys(VIEW_META) as View[]).map((v) => {
            const m = VIEW_META[v];
            const active = v === view;
            return (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-lg border p-3 text-left transition-colors ${active ? "border-pine bg-pine-soft/50" : "border-line hover:bg-mist"}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${m.dot}`} />
                <span className="mt-1 block text-sm font-semibold">{m.label}</span>
                <span className="mt-0.5 block text-xs text-ink-soft">{m.blurb}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <div className="mt-2 divide-y divide-line">
          {([
            ["replies", "Replies to my posts"],
            ["events", "Event reminders"],
            ["digest", "Weekly corridor digest"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between py-2.5 text-sm">
              <span>{label}</span>
              <button role="switch" aria-checked={notif[key]} onClick={() => toggle(key)}
                className={`h-5 w-9 rounded-full p-0.5 transition-colors ${notif[key] ? "bg-pine" : "bg-line"}`}>
                <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${notif[key] ? "translate-x-4" : ""}`} />
              </button>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <h2 className="text-sm font-semibold">Invite friends</h2>
        <p className="mt-1 text-xs text-ink-soft">3 of 5 invites remaining. Invites are the only door into BridgeLink — use them on people you would vouch for.</p>
        <div className="mt-3 flex gap-2">
          <code className="flex-1 truncate rounded-md border border-line bg-mist px-3 py-2 text-xs">{INVITE_LINK}</code>
          <button onClick={copy} className="flex items-center gap-1.5 rounded-md bg-pine px-3 py-2 text-sm font-medium text-white hover:bg-pine-ink">
            {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>
      </section>
    </div>
  );
}
