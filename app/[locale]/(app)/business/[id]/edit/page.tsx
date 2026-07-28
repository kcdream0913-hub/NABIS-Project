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
import ChipMultiSelect from "../../new/_components/guided/ChipMultiSelect";
import ChipSingleSelect from "../../new/_components/guided/ChipSingleSelect";
import {
  SERVICE_CATALOG, CUSTOMER_CHIPS, YEARS_CHIPS, CROSSBORDER_CHIPS, type SectorSlug,
} from "../../new/_lib/serviceCatalog";
import { EMPTY_ANSWERS, parseAnswers, type Answers } from "../../new/_lib/answers";
import { assembleBio } from "../../new/_lib/bioAssembler";

const INPUT = "mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary";
const SELECT = "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm";
const LABEL = "eyebrow text-ink-soft";

// Owner-only business editor. Unlike registration, this keeps BOTH bio fields —
// the Nepali bio is editable here (registration drops it for the worker to fill).
export default function EditBusinessPage() {
  const t = useTranslations("businessNew");
  const te = useTranslations("businessEdit");
  // Guided-answer question labels live under the `guided` namespace (GuidedBuilder
  // uses it too) — NOT businessNew, where these four keys don't exist (bl-i18n-01).
  const tg = useTranslations("guided");
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
  const [website, setWebsite] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [isGuided, setIsGuided] = useState(false);
  const [bioNeAuto, setBioNeAuto] = useState(false);
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
      const cred = (b.credentials ?? {}) as { looking_for?: unknown };
      setName(b.name ?? "");
      setCountry(b.country_of_registration ?? "United States");
      setCity(b.city ?? "");
      setBio(b.bio ?? "");
      setBioNe(b.bio_ne ?? "");
      setPrimarySector(b.primary_sector ?? "");
      setSecondarySectors((b.secondary_sectors as string[]) ?? []);
      setSocial((b.social_links ?? {}) as Record<string, string>);
      setLookingFor(cleanLookingFor(cred.looking_for));
      setWebsite(b.website_url ?? "");
      setPhone(b.phone ?? "");
      setAddressLine(b.address_line ?? "");
      setBioNeAuto(!!b.bio_ne_auto);
      setIsGuided(b.import_source === "guided");
      try {
        setAnswers(parseAnswers(b.profile_answers));
      } catch {
        setAnswers(EMPTY_ANSWERS);
      }
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
        // Owner-typed bios are not machine drafts; a fresh Regenerate sets bioNeAuto true.
        bio_ne_auto: bioNeAuto,
        city: city.trim() || null,
        website_url: website.trim() || null,
        phone: phone.trim() || null,
        address_line: addressLine.trim() || null,
        primary_sector: primarySector,
        secondary_sectors: secondarySectors,
        credentials: { looking_for: lookingFor },
        social_links: cleanSocialLinks(social),
        profile_answers: answers,
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
          <textarea value={bioNe} onChange={(e) => { setBioNe(e.target.value); setBioNeAuto(false); }} rows={3} lang="ne" className={INPUT} />
        </label>

        {/* Contact / web — real columns added by BL-BIZ-01, editable here (A-3). */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={LABEL}>{te("websiteLabel")}</span>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" inputMode="url" className={INPUT} />
          </label>
          <label className="block text-sm">
            <span className={LABEL}>{te("phoneLabel")}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className={INPUT} />
          </label>
        </div>
        <label className="block text-sm">
          <span className={LABEL}>{te("addressLabel")}</span>
          <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} className={INPUT} />
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

        {/* Guided answers + regenerate — only for guided-built businesses (A-3). */}
        {isGuided && (
          <div className="rounded-md border border-border bg-bg p-3">
            <p className="text-sm font-semibold">{te("answersHeading")}</p>
            <p className="mt-0.5 text-xs text-ink-soft">{te("answersHint")}</p>

            <p className="mt-3 text-xs font-medium text-ink-soft">{tg("qServices")}</p>
            <div className="mt-1.5">
              <ChipMultiSelect
                chips={primarySector ? SERVICE_CATALOG[primarySector as SectorSlug] : []}
                selected={answers.services}
                onToggle={(id) => setAnswers((a) => ({ ...a, services: a.services.includes(id) ? a.services.filter((x) => x !== id) : [...a.services, id] }))}
              />
            </div>

            <p className="mt-3 text-xs font-medium text-ink-soft">{tg("qCustomers")}</p>
            <div className="mt-1.5">
              <ChipMultiSelect
                chips={CUSTOMER_CHIPS}
                selected={answers.customers}
                onToggle={(id) => setAnswers((a) => ({ ...a, customers: a.customers.includes(id) ? a.customers.filter((x) => x !== id) : [...a.customers, id] }))}
              />
            </div>

            <p className="mt-3 text-xs font-medium text-ink-soft">{tg("qYears")}</p>
            <div className="mt-1.5">
              <ChipSingleSelect chips={YEARS_CHIPS} value={answers.years} onSelect={(id) => setAnswers((a) => ({ ...a, years: id }))} />
            </div>

            <p className="mt-3 text-xs font-medium text-ink-soft">{tg("qCrossborder")}</p>
            <div className="mt-1.5">
              <ChipSingleSelect chips={CROSSBORDER_CHIPS} value={answers.crossborder} onSelect={(id) => setAnswers((a) => ({ ...a, crossborder: id as Answers["crossborder"] }))} />
            </div>

            <button
              type="button"
              onClick={() => {
                if (!primarySector) return;
                setBio(assembleBio({ name, city: city || null, primarySector: primarySector as SectorSlug, answers, locale: "en" }));
                setBioNe(assembleBio({ name, city: city || null, primarySector: primarySector as SectorSlug, answers, locale: "ne" }));
                setBioNeAuto(true); // regenerated = machine draft again
              }}
              className="mt-3 rounded-md border border-border-input px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-surface-2"
            >
              {te("regenerateBio")}
            </button>
            <p className="mt-1 text-xs text-ink-soft">{te("regenerateHint")}</p>
          </div>
        )}

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
