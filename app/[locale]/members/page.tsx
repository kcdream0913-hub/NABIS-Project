"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { findOrCreateThread } from "@/lib/threads";
import { useSectors } from "@/lib/useSectors";

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
  primary_sector: string | null;
  secondary_sectors: string[];
  verification_status: string;
};

export default function DirectoryPage() {
  const t = useTranslations("directory");
  const sectors = useSectors();
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<"people" | "businesses">("people");
  const [q, setQ] = useState("");
  const [sector, setSector] = useState("all");
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
          .select("id, name, bio, country_of_registration, primary_sector, secondary_sectors, verification_status")
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
    if (sector !== "all" && b.primary_sector !== sector && !(b.secondary_sectors ?? []).includes(sector)) {
      return false;
    }
    return `${b.name} ${b.bio ?? ""}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div>
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>

      <div className="mt-3 flex gap-1 border-b border-line">
        {(["people", "businesses"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === tabKey ? "border-pine text-pine-ink" : "border-transparent text-ink-soft"
            }`}
          >
            {tabKey === "people" ? t("people") : t("businesses")}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="flex-1 rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
        />
        {tab === "businesses" && (
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="all">{t("allSectors")}</option>
            {sectors.map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-ink-soft">{t("loading")}</p>
      ) : tab === "people" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPeople.map((m) => (
            <div key={m.id} className="rounded-lg border border-line bg-white p-4">
              <Link href={`/people/${m.id}`} className="flex items-center gap-3 hover:opacity-80">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-pine-soft text-sm font-bold text-pine">
                  {(m.name ?? "?").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{m.name ?? t("member")}</p>
                  <p className="truncate text-xs text-ink-soft">{m.city}</p>
                </div>
              </Link>
              {m.bio && <p className="mt-3 line-clamp-2 text-sm text-ink-soft">{m.bio}</p>}
              <div className="mt-2 flex items-center justify-between">
                {m.verification_status === "verified" && (
                  <span className="inline-block rounded bg-bg-success px-1.5 py-0.5 text-[10px] font-semibold text-text-success">
                    Verified
                  </span>
                )}
                <button
                  onClick={async () => {
                    const threadId = await findOrCreateThread(m.id);
                    if (threadId) router.push(`/messages/${threadId}`);
                  }}
                  className="ml-auto rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-mist"
                >
                  {t("message")}
                </button>
              </div>
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
              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-ink-soft">
                <span className="font-medium text-ink">
                  {sectors.find((s) => s.slug === b.primary_sector)?.name ?? b.primary_sector}
                </span>
                {(b.secondary_sectors ?? []).map((slug) => (
                  <span key={slug} className="rounded bg-mist px-1 py-0.5">
                    {sectors.find((s) => s.slug === slug)?.name ?? slug}
                  </span>
                ))}
                <span>· {b.country_of_registration}</span>
              </p>
              {b.bio && <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{b.bio}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
