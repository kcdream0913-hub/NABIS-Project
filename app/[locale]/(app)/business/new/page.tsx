"use client";

import { useState } from "react";
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
} from "@/lib/businessProfile";

const INPUT = "mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary";
const SELECT = "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm";
const LABEL = "eyebrow text-ink-soft";
const STEP_KEYS = ["stepIdentity", "stepSectors", "stepPresence", "stepReview"] as const;

export default function NewBusinessPage() {
  const t = useTranslations("businessNew");
  const sectors = useSectors();
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  // Identity
  const [name, setName] = useState("");
  const [country, setCountry] = useState("United States");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  // Sectors
  const [primarySector, setPrimarySector] = useState<string>(sectors[0]?.slug ?? "");
  const [secondarySectors, setSecondarySectors] = useState<string[]>([]);
  // Presence
  const [social, setSocial] = useState<Record<string, string>>({});
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  // Review
  const [regNumber, setRegNumber] = useState("");
  // Intended access price only — recorded for when payments launch. is_paid_provider
  // is trigger-protected (forced false for non-admin writers, silently), so the
  // client never sends it and never claims charging is live. See BL-BIZ-02 §0/A-1.
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canProceed = step !== 0 || name.trim().length > 0;

  async function submit() {
    setSubmitting(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: business, error: insertError } = await supabase
      .from("businesses")
      .insert({
        name,
        country_of_registration: country,
        primary_sector: primarySector,
        secondary_sectors: secondarySectors,
        registration_number: regNumber || null,
        bio,
        // bio_ne is left for the translation worker; owners edit it on the
        // business edit page. bio_ne_auto stays false (nothing machine-made yet).
        bio_ne_auto: false,
        city: city.trim() || null,
        credentials: { looking_for: lookingFor },
        social_links: cleanSocialLinks(social),
        owner_user_id: user.id,
        // NB: is_paid_provider and verification_status are trigger-protected — never
        // sent from the client (would be a silent no-op). Only the intended price is
        // recorded; contact charging turns on when the payments rail launches.
        access_price_amount: price.trim() ? Number(price) : null,
        access_price_currency: currency,
      })
      .select()
      .single();

    if (insertError || !business) {
      setError(insertError?.message ?? t("genericError"));
      setSubmitting(false);
      return;
    }

    await supabase.from("business_members").insert({
      business_id: business.id,
      user_id: user.id,
      role: "owner",
      status: "active",
      can_post: true,
      verified_via: "self",
      added_by: user.id,
    });

    router.push(`/business/${business.id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-ink-soft">{t("subtitle")}</p>

      {/* Stepper header */}
      <ol className="mt-4 flex flex-wrap gap-1.5">
        {STEP_KEYS.map((k, i) => (
          <li key={k} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs font-medium ${
                i === step
                  ? "border-primary bg-primary-soft text-primary-pressed"
                  : i < step
                    ? "border-border text-ink-soft hover:bg-bg"
                    : "border-border text-ink-soft/60"
              }`}
            >
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface text-[11px]">{i + 1}</span>
              <span className="truncate">{t(k)}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4">
        {step === 0 && (
          <>
            <label className="block text-sm">
              <span className={LABEL}>{t("businessName")}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("businessNamePlaceholder")} className={INPUT} />
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
              <span className={LABEL}>{t("bio")}</span>
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={INPUT} />
              <span className="mt-1 block text-xs text-ink-soft">{t("bioHint")}</span>
            </label>
          </>
        )}

        {step === 1 && (
          <>
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
              <span className="mt-1 block text-xs text-ink-soft">{sectors.find((s) => s.slug === primarySector)?.description}</span>
            </label>
            <div>
              <span className={LABEL}>{t("secondarySectors")}</span>
              <p className="mt-0.5 text-xs text-ink-soft">{t("secondarySectorsHint")}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {sectors.filter((s) => s.slug !== primarySector).map((s) => {
                  const active = secondarySectors.includes(s.slug);
                  const atMax = secondarySectors.length >= MAX_SECONDARY_SECTORS;
                  return (
                    <button
                      key={s.slug}
                      type="button"
                      title={s.description}
                      disabled={!active && atMax}
                      onClick={() =>
                        setSecondarySectors((prev) =>
                          prev.includes(s.slug) ? prev.filter((x) => x !== s.slug) : [...prev, s.slug]
                        )
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
              {secondarySectors.length >= MAX_SECONDARY_SECTORS && (
                <p className="mt-1.5 text-xs text-ink-soft">{t("secondaryMaxReached")}</p>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <span className={LABEL}>{t("presenceHeading")}</span>
              <p className="mt-0.5 text-xs text-ink-soft">{t("presenceHint")}</p>
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
              <p className="mt-0.5 text-xs text-ink-soft">{t("lookingForHint")}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {LOOKING_FOR.map((k) => {
                  const active = lookingFor.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setLookingFor((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))}
                      aria-pressed={active}
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
          </>
        )}

        {step === 3 && (
          <>
            <label className="block text-sm">
              <span className={LABEL}>{t("regNumber")}</span>
              <input value={regNumber} onChange={(e) => setRegNumber(e.target.value)} placeholder={t("regNumberPlaceholder")} className={INPUT} />
              <span className="mt-1 block text-xs text-ink-soft">{t("regNumberHint")}</span>
            </label>

            {/* Access price is RECORDED only. Charging is not live — is_paid_provider
                is trigger-protected and there is no payments rail yet (A-1). No toggle
                that implies charging is on. */}
            <div className="rounded-md border border-border bg-bg p-3">
              <p className="text-sm font-medium">{t("plannedPriceTitle")}</p>
              <p className="mt-1 text-xs text-ink-soft">{t("plannedPriceHint")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)}
                  placeholder={t("amount")} className="w-32 rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
                />
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
                  <option>USD</option>
                  <option>NPR</option>
                </select>
              </div>
            </div>
          </>
        )}

        {error && <p className="text-sm text-accent" role="alert">{error}</p>}

        {/* Step controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-md border border-border px-3.5 py-2 text-sm font-medium text-ink-soft hover:bg-bg disabled:opacity-40"
          >
            {t("back")}
          </button>
          {step < STEP_KEYS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50"
            >
              {t("next")}
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={submitting || !name}
              className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50"
            >
              {submitting ? t("registering") : t("register")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
