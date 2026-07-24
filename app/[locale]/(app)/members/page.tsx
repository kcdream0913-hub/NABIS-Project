"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useSectors } from "@/lib/useSectors";
import MemberCard from "@/components/MemberCard";
import BusinessCard from "@/components/BusinessCard";
import type { View } from "@/lib/types";

type PersonRow = {
  id: string;
  name: string | null;
  bio: string | null;
  city: string | null;
  country: "us" | "nepal" | null;
  verification_status: string;
  bridge: boolean | null;
  avatar_url: string | null;
  preferences: { visibility?: string } | null;
};
type BusinessRow = {
  id: string;
  name: string;
  bio: string | null;
  country_of_registration: string | null;
  primary_sector: string | null;
  secondary_sectors: string[];
  verification_status: string;
  logo_url: string | null;
};

export default function DirectoryPage() {
  const t = useTranslations("directory");
  const tView = useTranslations("view");
  const sectors = useSectors();
  const supabase = createClient();
  const [tab, setTab] = useState<"people" | "businesses">("people");
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("all");
  const [view, setView] = useState<View>("bridge");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: p }, { data: b }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, name, bio, city, country, verification_status, bridge, avatar_url, preferences")
          .order("created_at", { ascending: false }),
        supabase
          .from("businesses")
          .select("id, name, bio, country_of_registration, primary_sector, secondary_sectors, verification_status, logo_url")
          .order("created_at", { ascending: false }),
      ]);
      setPeople(p ?? []);
      setBusinesses(b ?? []);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Normalize a free-text business country onto the two corridor countries.
  const normCountry = (c: string | null): "us" | "nepal" | null => {
    const l = (c ?? "").toLowerCase();
    if (l.includes("nepal") || l === "np") return "nepal";
    if (l.includes("united states") || l === "usa" || l === "us") return "us";
    return null;
  };
  // Bridge = corridor-wide (no country narrowing); US/Nepal narrow to that side.
  const inView = (c: "us" | "nepal" | null) => view === "bridge" || c === view;

  const filteredPeople = people.filter((m) => {
    // Visibility UX layer (RLS is the security floor). Private is never listed in
    // the directory even to a related viewer; bridge-only shows only in Bridge view.
    const vis = m.preferences?.visibility ?? "public";
    if (vis === "private") return false;
    if (vis === "bridge" && view !== "bridge") return false;
    if (verifiedOnly && m.verification_status !== "verified") return false;
    if (!inView(m.country)) return false;
    return `${m.name ?? ""} ${m.bio ?? ""} ${m.city ?? ""}`.toLowerCase().includes(q.toLowerCase());
  });
  const filteredBusinesses = businesses.filter((b) => {
    if (verifiedOnly && b.verification_status !== "verified") return false;
    if (!inView(normCountry(b.country_of_registration))) return false;
    if (sector !== "all" && b.primary_sector !== sector && !(b.secondary_sectors ?? []).includes(sector)) {
      return false;
    }
    return `${b.name} ${b.bio ?? ""}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div>
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>

      <div className="mt-3 flex gap-1 border-b border-border">
        {(["people", "businesses"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === tabKey ? "border-primary text-primary-pressed" : "border-transparent text-ink-soft"
            }`}
          >
            {tabKey === "people" ? t("people") : t("businesses")}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="min-w-[12rem] flex-1 rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
        />
        <select
          value={view}
          onChange={(e) => setView(e.target.value as View)}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
          aria-label={tView("label")}
        >
          <option value="bridge">{tView("bridgeShort")}</option>
          <option value="us">{tView("usShort")}</option>
          <option value="nepal">{tView("nepalShort")}</option>
        </select>
        {tab === "businesses" && (
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="all">{t("allSectors")}</option>
            {sectors.map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => setVerifiedOnly(e.target.checked)}
            className="accent-primary"
          />
          {t("verifiedOnly")}
        </label>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-soft">{t("loading")}</p>
      ) : tab === "people" ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPeople.map((m) => (
            <MemberCard
              key={m.id}
              id={m.id}
              name={m.name ?? t("member")}
              avatarUrl={m.avatar_url}
              headline={m.bio}
              location={m.city}
              view={m.country ?? undefined}
              viewLabel={m.country ? tView(`${m.country}Short`) : undefined}
              verification={m.verification_status === "verified" ? "verified" : "unverified"}
              tier={m.bridge ? "bridge" : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBusinesses.map((b) => {
            const country = normCountry(b.country_of_registration);
            return (
              <BusinessCard
                key={b.id}
                id={b.id}
                name={b.name}
                logoUrl={b.logo_url}
                bio={b.bio}
                primarySector={
                  b.primary_sector
                    ? sectors.find((s) => s.slug === b.primary_sector)?.name ?? b.primary_sector
                    : null
                }
                secondarySectors={(b.secondary_sectors ?? []).map(
                  (slug) => sectors.find((s) => s.slug === slug)?.name ?? slug
                )}
                view={country ?? undefined}
                viewLabel={country ? tView(`${country}Short`) : undefined}
                verificationStatus={b.verification_status === "verified" ? "verified" : "unverified"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
