"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { SECTORS } from "@/lib/sectors";

type PersonRow = {
  id: string;
  name: string | null;
  bio: string | null;
  city: string | null;
  country: "us" | "nepal" | null;
  verification_status: string;
};
type BusinessRow = {
  id: string;
  name: string;
  bio: string | null;
  country_of_registration: string | null;
  sector: string | null;
  verification_status: string;
};

export default function DirectoryPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<"people" | "businesses">("people");
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("All sectors");
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: p }, { data: b }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, name, bio, city, country, verification_status")
          .order("created_at", { ascending: false }),
        supabase
          .from("businesses")
          .select("id, name, bio, country_of_registration, sector, verification_status")
          .order("created_at", { ascending: false }),
      ]);
      setPeople(p ?? []);
      setBusinesses(b ?? []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredPeople = people.filter((m) =>
    `${m.name ?? ""} ${m.bio ?? ""} ${m.city ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );
  const filteredBusinesses = businesses.filter((b) => {
    if (sector !== "All sectors" && b.sector !== sector) return false;
    return `${b.name} ${b.bio ?? ""}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div>
      <p className="eyebrow text-ink-soft">Directory</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">Members &amp; businesses</h1>

      <div className="mt-3 flex gap-1 border-b border-line">
        {(["people", "businesses"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t ? "border-pine text-pine-ink" : "border-transparent text-ink-soft"
            }`}
          >
            {t === "people" ? "People" : "Businesses"}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, business, or city"
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
        />
        {tab === "businesses" && (
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm"
          >
            <option>All sectors</option>
            {SECTORS.map((s) => (
              <option key={s.slug}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-soft">Loading…</p>
      ) : tab === "people" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPeople.map((m) => (
            <div key={m.id} className="rounded-lg border border-line bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-pine-soft text-sm font-bold text-pine">
                  {(m.name ?? "?").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{m.name ?? "Member"}</p>
                  <p className="truncate text-xs text-ink-soft">{m.city}</p>
                </div>
              </div>
              {m.bio && <p className="mt-3 line-clamp-2 text-sm text-ink-soft">{m.bio}</p>}
              {m.verification_status === "verified" && (
                <span className="mt-2 inline-block rounded bg-bg-success px-1.5 py-0.5 text-[10px] font-semibold text-text-success">
                  Verified
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBusinesses.map((b) => (
            <Link
              key={b.id}
              href={`/business/${b.id}`}
              className="rounded-lg border border-line bg-white p-4 hover:border-pine"
            >
              <p className="text-sm font-semibold">{b.name}</p>
              <p className="text-xs text-ink-soft">{b.sector} · {b.country_of_registration}</p>
              {b.bio && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{b.bio}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
