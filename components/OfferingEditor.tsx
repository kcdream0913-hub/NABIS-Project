"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DIRECTION_TAGS,
  OFFERING_CURRENCIES,
  OFFERING_TYPES,
  PRICE_UNITS,
  SEASONS,
  TOURISM_SECTOR,
  type Festival,
  type Offering,
  type OfferingCountry,
  type OfferingOwnerType,
  type OfferingType,
  type PriceUnit,
} from "@/lib/offerings";

const INPUT = "mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary";
const SELECT = "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm";
const LABEL = "eyebrow text-ink-soft";

function Chip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "border-primary bg-primary-soft text-primary-pressed" : "border-border text-ink-soft hover:bg-bg"
      }`}
    >
      {children}
    </button>
  );
}

// Create/edit an offering. Publishing from a business page sets business_id;
// from own profile sets profile_id — never both (DB CHECK enforces). Media upload
// is intentionally out of scope here (media stays []); it's a tracked follow-up.
export default function OfferingEditor({
  mode,
  ownerType,
  businessId,
  offering,
}: {
  mode: "create" | "edit";
  ownerType: OfferingOwnerType;
  businessId?: string;
  offering?: Offering;
}) {
  const t = useTranslations("offerings");
  const router = useRouter();
  const supabase = createClient();

  const [type, setType] = useState<OfferingType>(offering?.type ?? "trek");
  const [title, setTitle] = useState(offering?.title ?? "");
  const [titleNe, setTitleNe] = useState(offering?.title_ne ?? "");
  const [description, setDescription] = useState(offering?.description ?? "");
  const [descriptionNe, setDescriptionNe] = useState(offering?.description_ne ?? "");
  const [country, setCountry] = useState<"" | OfferingCountry>(offering?.country ?? "");
  const [region, setRegion] = useState(offering?.region ?? "");
  const [directionTags, setDirectionTags] = useState<string[]>(offering?.direction_tags ?? []);
  const [priceFrom, setPriceFrom] = useState(offering?.price_from != null ? String(offering.price_from) : "");
  const [priceCurrency, setPriceCurrency] = useState(offering?.price_currency ?? "USD");
  const [priceUnit, setPriceUnit] = useState<PriceUnit>(offering?.price_unit ?? "per_person");
  const [durationDays, setDurationDays] = useState(offering?.duration_days != null ? String(offering.duration_days) : "");
  const [groupMin, setGroupMin] = useState(offering?.group_min != null ? String(offering.group_min) : "");
  const [groupMax, setGroupMax] = useState(offering?.group_max != null ? String(offering.group_max) : "");
  const [seasons, setSeasons] = useState<string[]>(offering?.seasons ?? []);
  const [festivalSlugs, setFestivalSlugs] = useState<string[]>(offering?.festival_slugs ?? []);
  const [availableFrom, setAvailableFrom] = useState(offering?.available_from ?? "");
  const [availableTo, setAvailableTo] = useState(offering?.available_to ?? "");
  const [status, setStatus] = useState<"draft" | "published">(
    offering?.status === "published" ? "published" : "draft",
  );

  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("festivals")
      .select("*")
      .then(({ data }) => setFestivals((data as Festival[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const festivalsByCountry = useMemo(() => {
    const groups: Record<string, Festival[]> = { np: [], us: [] };
    for (const f of festivals) {
      const key = f.country ?? "np";
      (groups[key] ??= []).push(f);
    }
    return groups;
  }, [festivals]);

  function toggle(list: string[], set: (v: string[]) => void, v: string) {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  }

  const num = (s: string): number | null => (s.trim() === "" ? null : Number(s));

  async function save() {
    setError(null);
    if (!title.trim()) return setError(t("errTitleRequired"));
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const payload = {
      type,
      title: title.trim(),
      title_ne: titleNe.trim() || null,
      description: description.trim() || null,
      description_ne: descriptionNe.trim() || null,
      country: country || null,
      region: region.trim() || null,
      direction_tags: directionTags,
      price_from: num(priceFrom),
      price_currency: priceCurrency,
      price_unit: priceUnit,
      duration_days: num(durationDays),
      group_min: num(groupMin),
      group_max: num(groupMax),
      seasons,
      festival_slugs: festivalSlugs,
      available_from: availableFrom || null,
      available_to: availableTo || null,
      status,
    };

    if (mode === "edit" && offering) {
      const { error: e } = await supabase.from("offerings").update(payload).eq("id", offering.id);
      if (e) {
        setError(e.message);
        setSaving(false);
        return;
      }
      router.push(`/offerings/${offering.id}`);
      return;
    }

    // create — set exactly the owner FK for this context.
    const owner =
      ownerType === "business"
        ? { owner_type: "business" as const, business_id: businessId }
        : { owner_type: "profile" as const, profile_id: user.id };

    const { data, error: e } = await supabase
      .from("offerings")
      .insert({ ...payload, ...owner, sector: TOURISM_SECTOR })
      .select("id")
      .single();
    if (e || !data) {
      setError(e?.message ?? t("genericError"));
      setSaving(false);
      return;
    }
    router.push(`/offerings/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow text-ink-soft">{t("editorEyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">
        {mode === "edit" ? t("editTitle") : t("newTitle")}
      </h1>
      <p className="mt-1 text-sm text-ink-soft">{t("editorSubtitle")}</p>

      <div className="mt-5 space-y-3 rounded-lg border border-border bg-surface p-4">
        <label className="block text-sm">
          <span className={LABEL}>{t("fieldType")}</span>
          <select value={type} onChange={(e) => setType(e.target.value as OfferingType)} className={SELECT}>
            {OFFERING_TYPES.map((ty) => (
              <option key={ty} value={ty}>{t(`types.${ty}`)}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className={LABEL}>{t("fieldTitle")}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT} />
        </label>
        <label className="block text-sm">
          <span className={LABEL}>{t("fieldTitleNe")}</span>
          <input value={titleNe} onChange={(e) => setTitleNe(e.target.value)} lang="ne" className={INPUT} />
        </label>

        <label className="block text-sm">
          <span className={LABEL}>{t("fieldDescription")}</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={INPUT} />
        </label>
        <label className="block text-sm">
          <span className={LABEL}>{t("fieldDescriptionNe")}</span>
          <textarea value={descriptionNe} onChange={(e) => setDescriptionNe(e.target.value)} rows={3} lang="ne" className={INPUT} />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={LABEL}>{t("fieldCountry")}</span>
            <select value={country} onChange={(e) => setCountry(e.target.value as OfferingCountry | "")} className={SELECT}>
              <option value="">{t("countryAny")}</option>
              <option value="np">{t("country.np")}</option>
              <option value="us">{t("country.us")}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className={LABEL}>{t("fieldRegion")}</span>
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder={t("fieldRegionPlaceholder")} className={INPUT} />
          </label>
        </div>

        <div>
          <span className={LABEL}>{t("fieldDirections")}</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {DIRECTION_TAGS.map((d) => (
              <Chip key={d} active={directionTags.includes(d)} onClick={() => toggle(directionTags, setDirectionTags, d)}>
                {t(`directions.${d}`)}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <span className={LABEL}>{t("fieldPrice")}</span>
          <div className="mt-1 flex flex-wrap gap-2">
            <input
              type="number" min="0" step="0.01" value={priceFrom} onChange={(e) => setPriceFrom(e.target.value)}
              placeholder={t("fieldPriceFrom")} className="w-32 rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
            />
            <select value={priceCurrency} onChange={(e) => setPriceCurrency(e.target.value)} className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
              {OFFERING_CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={priceUnit} onChange={(e) => setPriceUnit(e.target.value as PriceUnit)} className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
              {PRICE_UNITS.map((u) => <option key={u} value={u}>{t(`units.${u}`)}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className={LABEL}>{t("fieldDuration")}</span>
            <input type="number" min="0" value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className={INPUT} />
          </label>
          <label className="block text-sm">
            <span className={LABEL}>{t("fieldGroupMin")}</span>
            <input type="number" min="0" value={groupMin} onChange={(e) => setGroupMin(e.target.value)} className={INPUT} />
          </label>
          <label className="block text-sm">
            <span className={LABEL}>{t("fieldGroupMax")}</span>
            <input type="number" min="0" value={groupMax} onChange={(e) => setGroupMax(e.target.value)} className={INPUT} />
          </label>
        </div>

        <div>
          <span className={LABEL}>{t("fieldSeasons")}</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SEASONS.map((s) => (
              <Chip key={s} active={seasons.includes(s)} onClick={() => toggle(seasons, setSeasons, s)}>
                {t(`seasons.${s}`)}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <span className={LABEL}>{t("fieldFestivals")}</span>
          {(["np", "us"] as const).map((c) =>
            (festivalsByCountry[c] ?? []).length > 0 ? (
              <div key={c} className="mt-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{t(`country.${c}`)}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {festivalsByCountry[c].map((f) => (
                    <Chip key={f.slug} active={festivalSlugs.includes(f.slug)} onClick={() => toggle(festivalSlugs, setFestivalSlugs, f.slug)}>
                      {f.name}
                      {f.month_hint ? <span className="ml-1 text-[11px] font-normal opacity-70">· {f.month_hint}</span> : null}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className={LABEL}>{t("fieldAvailableFrom")}</span>
            <input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} className={INPUT} />
          </label>
          <label className="block text-sm">
            <span className={LABEL}>{t("fieldAvailableTo")}</span>
            <input type="date" value={availableTo} onChange={(e) => setAvailableTo(e.target.value)} className={INPUT} />
          </label>
        </div>

        <label className="block text-sm">
          <span className={LABEL}>{t("fieldStatus")}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")} className={SELECT}>
            <option value="draft">{t("status.draft")}</option>
            <option value="published">{t("status.published")}</option>
          </select>
          <span className="mt-1 block text-xs text-ink-soft">{t("statusHint")}</span>
        </label>

        <p className="rounded-md border border-dashed border-border bg-bg p-2.5 text-xs text-ink-soft">{t("mediaFollowUp")}</p>

        {error && <p className="text-sm text-accent" role="alert">{error}</p>}

        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50"
        >
          {saving ? t("saving") : mode === "edit" ? t("saveChanges") : t("createOffering")}
        </button>
      </div>
    </div>
  );
}
