"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/countries";
import { useSectors } from "@/lib/useSectors";
import {
  LOOKING_FOR,
  SOCIAL_FIELDS,
  MAX_SECONDARY_SECTORS,
  cleanSocialLinks,
  cleanLookingFor,
} from "@/lib/businessProfile";

const INPUT = "mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary";
const SELECT = "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm";
const LABEL = "eyebrow text-ink-soft";

// Owner-only business editor. Unlike registration, this keeps BOTH bio fields —
// the Nepali bio is editable here (registration drops it for the worker to fill).
export default function EditBusinessPage() {
  const t = useTranslations("businessNew");
  const te = useTranslations("businessEdit");
  const sectors = useSectors();
  const router = useRouter();
  const supabase = createClient();
  const id = String(useParams().id);

  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("United States");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [bioNe, setBioNe] = useState("");
  const [primarySector, setPrimarySector] = useState("");
  const [secondarySectors, setSecondarySectors] = useState<string[]>([]);
  const [social, setSocial] = useState<Record<string, string>>({});
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data: b } = await supabase.from("businesses").select("*").eq("id", id).single();
      if (!b || b.owner_user_id !== user.id) {
        setState("denied");
        return;
      }
      const cred = (b.credentials ?? {}) as { city?: string | null; looking_for?: unknown };
      setName(b.name ?? "");
      setCountry(b.country_of_registration ?? "United States");
      setCity(cred.city ?? "");
      setBio(b.bio ?? "");
      setBioNe(b.bio_ne ?? "");
      setPrimarySector(b.primary_sector ?? "");
      setSecondarySectors((b.secondary_sectors as string[]) ?? []);
      setSocial((b.social_links ?? {}) as Record<string, string>);
      setLookingFor(cleanLookingFor(cred.looking_for));
      setState("ok");
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    setSaving(true);
    setError(null);
    const { error: e } = await supabase
      .from("businesses")
      .update({
        name,
        country_of_registration: country,
        bio,
        bio_ne: bioNe.trim() || null,
        // Editing here means the owner reviewed the Nepali bio — no longer a draft.
        bio_ne_auto: false,
        primary_sector: primarySector,
        secondary_sectors: secondarySectors,
        credentials: { city: city.trim() || null, looking_for: lookingFor },
        social_links: cleanSocialLinks(social),
      })
      .eq("id", id);
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    setSaved(true);
    router.push(`/business/${id}`);
  }

  if (state === "loading") return <p className="p-6 text-sm text-ink-soft">{t("registering")}</p>;
  if (state === "denied")
    return (
      <div className="mx-auto max-w-xl p-6">
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-soft">{te("denied")}</p>
      </div>
    );

  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow text-ink-soft">{te("eyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{te("title")}</h1>

      <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
        <label className="block text-sm">
          <span className={LABEL}>{t("businessName")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={LABEL}>{t("countryOfRegistration")}</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={SELECT}>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className={LABEL}>{t("city")}</span>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("cityPlaceholder")} className={INPUT} />
          </label>
        </div>

        <label className="block text-sm">
          <span className={LABEL}>{t("bioEn")}</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={INPUT} />
        </label>
        <label className="block text-sm">
          <span className={LABEL}>{t("bioNe")}</span>
          <textarea value={bioNe} onChange={(e) => setBioNe(e.target.value)} rows={3} lang="ne" className={INPUT} />
        </label>

        <label className="block text-sm">
          <span className={LABEL}>{t("primarySector")}</span>
          <select
            value={primarySector}
            onChange={(e) => {
              const next = e.target.value;
              setPrimarySector(next);
              setSecondarySectors((prev) => prev.filter((s) => s !== next));
            }}
            className={SELECT}
          >
            {sectors.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </label>
        <div>
          <span className={LABEL}>{t("secondarySectors")}</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {sectors.filter((s) => s.slug !== primarySector).map((s) => {
              const active = secondarySectors.includes(s.slug);
              const atMax = secondarySectors.length >= MAX_SECONDARY_SECTORS;
              return (
                <button
                  key={s.slug}
                  type="button"
                  disabled={!active && atMax}
                  onClick={() =>
                    setSecondarySectors((prev) => (prev.includes(s.slug) ? prev.filter((x) => x !== s.slug) : [...prev, s.slug]))
                  }
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                    active ? "border-primary bg-primary-soft text-primary-pressed" : "border-border text-ink-soft hover:bg-bg"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className={LABEL}>{t("presenceHeading")}</span>
          <div className="mt-2 space-y-2">
            {SOCIAL_FIELDS.map((f) => (
              <label key={f} className="block text-sm">
                <span className="text-xs font-medium text-ink-soft">{t(`social.${f}`)}</span>
                <input
                  value={social[f] ?? ""}
                  onChange={(e) => setSocial((prev) => ({ ...prev, [f]: e.target.value }))}
                  placeholder={t(`socialPlaceholder.${f}`)}
                  inputMode="url"
                  className="mt-0.5 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <span className={LABEL}>{t("lookingForHeading")}</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {LOOKING_FOR.map((k) => {
              const active = lookingFor.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setLookingFor((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    active ? "border-primary bg-primary-soft text-primary-pressed" : "border-border text-ink-soft hover:bg-bg"
                  }`}
                >
                  {t(`lookingFor.${k}`)}
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="text-sm text-accent" role="alert">{error}</p>}

        <button
          onClick={save}
          disabled={saving || !name.trim()}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50"
        >
          {saved ? t("registering") : saving ? te("saving") : te("save")}
        </button>
      </div>
    </div>
  );
}
