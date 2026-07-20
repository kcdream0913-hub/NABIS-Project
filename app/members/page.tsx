"use client";

import { useMemo, useState } from "react";
import { SearchX } from "lucide-react";
import MemberCard from "@/components/MemberCard";
import EmptyState from "@/components/EmptyState";
import { MEMBERS } from "@/lib/data";
import type { Role } from "@/lib/types";

const ROLES: (Role | "All roles")[] = ["All roles", "Business Owner", "Entrepreneur", "Investor", "Creator", "Professional"];
const LOCATIONS = ["Everywhere", "United States", "Nepal"] as const;

export default function MembersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("All roles");
  const [loc, setLoc] = useState<(typeof LOCATIONS)[number]>("Everywhere");

  const filtered = useMemo(() => {
    return MEMBERS.filter((m) => {
      if (role !== "All roles" && m.role !== role) return false;
      if (loc === "United States" && m.country !== "us") return false;
      if (loc === "Nepal" && m.country !== "nepal") return false;
      if (q && !`${m.name} ${m.bio} ${m.location}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [q, role, loc]);

  return (
    <div>
      <p className="eyebrow text-ink-soft">Directory</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Members</h1>
      <p className="mt-1 text-sm text-ink-soft">Every profile here was invited and approved. {MEMBERS.length} members and growing.</p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, business, or city"
          className="flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm placeholder:text-ink-soft focus:border-pine"
        />
        <select value={loc} onChange={(e) => setLoc(e.target.value as (typeof LOCATIONS)[number])}
          className="rounded-md border border-line bg-white px-3 py-2 text-sm">
          {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
          className="rounded-md border border-line bg-white px-3 py-2 text-sm">
          {ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={SearchX} title="No members match" body="Loosen a filter or try a different search term. New members join every week." />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => <MemberCard key={m.id} member={m} />)}
        </div>
      )}
    </div>
  );
}
