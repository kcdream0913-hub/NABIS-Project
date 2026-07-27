"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import SectorGrid from "./SectorGrid";
import ChipMultiSelect from "./ChipMultiSelect";
import ChipSingleSelect from "./ChipSingleSelect";
import DictationField from "./DictationField";
import CityCombobox from "./CityCombobox";
import BioReview, { type BioReviewResult } from "./BioReview";
import {
  SERVICE_CATALOG, CUSTOMER_CHIPS, YEARS_CHIPS, CROSSBORDER_CHIPS, type SectorSlug, type Locale,
} from "../../_lib/serviceCatalog";
import { EMPTY_ANSWERS, type Answers } from "../../_lib/answers";
import { assembleBio } from "../../_lib/bioAssembler";
import { MAX_SECONDARY_SECTORS } from "@/lib/businessProfile";

const QUESTION_COUNT = 8; // G1, G2, G2b, G3, G4, G4b, G5, G5b (G1b folds into G1)

export type GuidedInitial = { name?: string; city?: string; primarySector?: string; secondarySectors?: string[] };

export default function GuidedBuilder({
  initial,
  onShared,
  switchLink,
}: {
  initial?: GuidedInitial;
  onShared?: (v: GuidedInitial) => void;
  switchLink?: React.ReactNode;
}) {
  const t = useTranslations("guided");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0); // 0..7 questions, 8 = review
  const [name, setName] = useState(initial?.name ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [primary, setPrimary] = useState<string>(initial?.primarySector ?? "");
  const [secondary, setSecondary] = useState<string[]>(initial?.secondarySectors ?? []);
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [nameTouched, setNameTouched] = useState(false);
  const [cityTouched, setCityTouched] = useState(false);
  const [regenKey, setRegenKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(p: Partial<Answers>) {
    setAnswers((a) => ({ ...a, ...p }));
  }
  function shareUp(next: Partial<GuidedInitial>) {
    onShared?.({ name, city, primarySector: primary, secondarySectors: secondary, ...next });
  }

  // Assembled bios for the review step (re-computed each render; Regenerate bumps
  // regenKey so BioReview resets its editable copy to the fresh machine text).
  const assembledEn = useMemo(
    () => (primary ? assembleBio({ name, city: city || null, primarySector: primary as SectorSlug, answers, locale: "en" }) : ""),
    [name, city, primary, answers],
  );
  const assembledNe = useMemo(
    () => (primary ? assembleBio({ name, city: city || null, primarySector: primary as SectorSlug, answers, locale: "ne" }) : ""),
    [name, city, primary, answers],
  );

  const serviceCatalog = primary ? SERVICE_CATALOG[primary as SectorSlug] : [];

  // Per-question required gate for the Continue button.
  const canContinue = (() => {
    if (step === 0) return !!primary;
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return city.trim().length > 0;
    return true; // 3..7 optional
  })();

  async function save(r: BioReviewResult) {
    setSaving(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    // differentiator language ~ the active UI locale (recorded so the translation
    // worker can find it later; never machine-translated).
    const finalAnswers: Answers = { ...answers, differentiatorLocale: answers.differentiator ? locale : null };

    const { data: business, error: e } = await supabase
      .from("businesses")
      .insert({
        name,
        country_of_registration: "Nepal",
        city: city.trim() || null,
        primary_sector: primary,
        secondary_sectors: secondary,
        bio: r.bioEn,
        bio_ne: r.bioNe,
        // Assembled and not hand-edited → still a machine draft.
        bio_ne_auto: !r.editedNe,
        import_source: "guided",
        profile_answers: finalAnswers,
        field_sources: { bio: r.editedEn || r.editedNe ? "typed" : "assisted" },
        social_links: {},
        credentials: {},
        owner_user_id: user.id,
        // is_paid_provider / verification_status are trigger-protected — never sent.
      })
      .select()
      .single();

    if (e || !business) {
      setError(e?.message ?? t("saveError"));
      setSaving(false);
      return;
    }
    await supabase.from("business_members").insert({
      business_id: business.id, user_id: user.id, role: "owner", status: "active",
      can_post: true, verified_via: "self", added_by: user.id,
    });
    router.push(`/business/${business.id}`);
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-xl flex-col pb-24">
      <div className="flex items-center justify-between">
        <p className="eyebrow text-ink-soft">
          {step < QUESTION_COUNT ? t("questionOf", { n: step + 1, total: QUESTION_COUNT }) : t("reviewEyebrow")}
        </p>
        {switchLink}
      </div>

      <div className="mt-3 flex-1">
        {step === 0 && (
          <div>
            <h2 className="text-lg font-semibold">{t("qSector")}</h2>
            <div className="mt-3">
              <SectorGrid selected={primary ? [primary] : []} onToggle={(s) => { setPrimary(s); setSecondary((prev) => prev.filter((x) => x !== s)); }} />
            </div>
            {primary && (
              <div className="mt-5">
                <h3 className="text-sm font-medium text-ink">{t("qSecondary")}</h3>
                <p className="mt-0.5 text-xs text-ink-soft">{t("qSecondaryHint")}</p>
                <div className="mt-2">
                  <SectorGrid
                    selected={secondary}
                    disabledSlug={primary}
                    atMax={secondary.length >= MAX_SECONDARY_SECTORS}
                    onToggle={(s) => setSecondary((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold">{t("qName")}</h2>
            <div className="mt-3">
              <DictationField
                label={t("nameLabel")} value={name}
                onChange={(v) => { setName(v); shareUp({ name: v }); }}
                onBlur={() => setNameTouched(true)}
                autoCapitalize="words" spellCheck={false} autoCorrect={false}
                error={nameTouched && !name.trim() ? t("nameRequired") : null}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold">{t("qCity")}</h2>
            <div className="mt-3">
              <CityCombobox value={city} onChange={(v) => { setCity(v); shareUp({ city: v }); }} onBlur={() => setCityTouched(true)} />
              {cityTouched && !city.trim() && <p className="mt-1 text-xs text-accent" role="alert">{t("cityRequired")}</p>}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold">{t("qServices")}</h2>
            <div className="mt-3">
              <ChipMultiSelect chips={serviceCatalog} selected={answers.services} onToggle={(id) => patch({ services: answers.services.includes(id) ? answers.services.filter((x) => x !== id) : [...answers.services, id] })} />
              <div className="mt-3">
                <DictationField label={t("somethingElse")} value={answers.extraServices ?? ""} onChange={(v) => patch({ extraServices: v || null })} />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold">{t("qCustomers")}</h2>
            <div className="mt-3">
              <ChipMultiSelect chips={CUSTOMER_CHIPS} selected={answers.customers} onToggle={(id) => patch({ customers: answers.customers.includes(id) ? answers.customers.filter((x) => x !== id) : [...answers.customers, id] })} />
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="text-lg font-semibold">{t("qYears")}</h2>
            <div className="mt-3">
              <ChipSingleSelect chips={YEARS_CHIPS} value={answers.years} onSelect={(id) => patch({ years: id })} />
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <h2 className="text-lg font-semibold">{t("qDifferentiator")}</h2>
            <p className="mt-0.5 text-xs text-ink-soft">{t("optionalHint")}</p>
            <div className="mt-3">
              <DictationField label={t("differentiatorLabel")} value={answers.differentiator ?? ""} onChange={(v) => patch({ differentiator: v || null })} multiline autoCapitalize="sentences" lang={locale} />
            </div>
          </div>
        )}

        {step === 7 && (
          <div>
            <h2 className="text-lg font-semibold">{t("qCrossborder")}</h2>
            <div className="mt-3">
              <ChipSingleSelect chips={CROSSBORDER_CHIPS} value={answers.crossborder} onSelect={(id) => patch({ crossborder: id as Answers["crossborder"] })} />
            </div>
          </div>
        )}

        {step === QUESTION_COUNT && (
          <BioReview
            assembledEn={assembledEn}
            assembledNe={assembledNe}
            regenKey={regenKey}
            onRegenerate={() => setRegenKey((k) => k + 1)}
            onConfirm={save}
            saving={saving}
          />
        )}

        {error && <p className="mt-3 text-sm text-accent" role="alert">{error}</p>}
      </div>

      {/* Bottom-fixed nav so Continue is always reachable on a phone (§10). */}
      {step <= QUESTION_COUNT && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-xl items-center gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="min-h-[56px] rounded-lg border border-border-input px-4 py-3 text-sm font-medium text-ink-soft hover:bg-surface-2">
                {t("back")}
              </button>
            )}
            {step < QUESTION_COUNT ? (
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => setStep((s) => s + 1)}
                className="min-h-[56px] flex-1 rounded-lg bg-primary px-5 text-base font-semibold text-on-primary hover:bg-primary-pressed disabled:opacity-50"
              >
                {requiredAt(step) ? t("continue") : t("skip")}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// Optional steps show "Continue / Skip"; required ones just "Continue".
function requiredAt(step: number): boolean {
  return step === 0 || step === 1 || step === 2;
}
