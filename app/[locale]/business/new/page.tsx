"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/countries";
import { useSectors } from "@/lib/useSectors";

export default function NewBusinessPage() {
  const t = useTranslations("businessNew");
  const sectors = useSectors();
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState("");
  const [country, setCountry] = useState("United States");
  const [primarySector, setPrimarySector] = useState<string>(sectors[0]?.slug ?? "");
  const [secondarySectors, setSecondarySectors] = useState<string[]>([]);
  const [regNumber, setRegNumber] = useState("");
  const [bio, setBio] = useState("");
  const [isPaidProvider, setIsPaidProvider] = useState(false);
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        owner_user_id: user.id,
        // Tier 1 "Listed" (no number) vs Tier 2 pending registry check — never
        // auto-marked "verified" client-side either way; that comes from the
        // verification job. See spec §5.3 (D-015).
        verification_status: "unverified",
        is_paid_provider: isPaidProvider,
        access_price_amount: isPaidProvider ? Number(price) : null,
        access_price_currency: currency,
      })
      .select()
      .single();

    if (insertError || !business) {
      setError(insertError?.message ?? t("genericError"));
      setSubmitting(false);
      return;
    }

    // Owner is auto-added as the first team member (spec §5.3: only the owner
    // can add/remove others from here on).
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
      <p className="mt-1 text-sm text-ink-soft">
        {t("subtitle")}
      </p>

      <div className="mt-5 space-y-3 rounded-lg border border-line bg-white p-4">
        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">{t("businessName")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("businessNamePlaceholder")}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="eyebrow text-ink-soft">{t("countryOfRegistration")}</span>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            >
              {COUNTRIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="eyebrow text-ink-soft">{t("primarySector")}</span>
            <select
              value={primarySector}
              onChange={(e) => {
                const next = e.target.value;
                setPrimarySector(next);
                // A sector can't be both primary and secondary at once.
                setSecondarySectors((prev) => prev.filter((s) => s !== next));
              }}
              className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            >
              {sectors.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-ink-soft">
              {sectors.find((s) => s.slug === primarySector)?.description}
            </span>
          </label>
        </div>

        <div>
          <span className="eyebrow text-ink-soft">{t("secondarySectors")}</span>
          <p className="mt-0.5 text-xs text-ink-soft">{t("secondarySectorsHint")}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {sectors
              .filter((s) => s.slug !== primarySector)
              .map((s) => {
                const active = secondarySectors.includes(s.slug);
                const atMax = secondarySectors.length >= 2;
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
                      active ? "border-pine bg-pine-soft text-pine-ink" : "border-line text-ink-soft hover:bg-mist"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
          </div>
          {secondarySectors.length >= 2 && (
            <p className="mt-1.5 text-xs text-ink-soft">{t("secondaryMaxReached")}</p>
          )}
        </div>

        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">{t("regNumber")}</span>
          <input
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value)}
            placeholder={t("regNumberPlaceholder")}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
          />
          <span className="mt-1 block text-xs text-ink-soft">
            {t("regNumberHint")}
          </span>
        </label>

        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">{t("bio")}</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
          />
        </label>

        {/* Paid access — spec §5.13. Requires Tier 2 (registration number). */}
        <div className="rounded-md border border-line bg-mist p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isPaidProvider}
              disabled={!regNumber}
              onChange={(e) => setIsPaidProvider(e.target.checked)}
              className="h-4 w-4 accent-pine disabled:opacity-40"
            />
            {t("chargeFee")}
          </label>
          <p className="mt-1 text-xs text-ink-soft">
            {regNumber
              ? t("chargeFeeHintUnlocked")
              : t("chargeFeeHintLocked")}
          </p>
          {isPaidProvider && (
            <div className="mt-2 flex gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={t("amount")}
                className="w-32 rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="rounded-md border border-line bg-white px-3 py-2 text-sm"
              >
                <option>USD</option>
                <option>NPR</option>
              </select>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-rhodo">{error}</p>}

        <button
          onClick={submit}
          disabled={submitting || !name}
          className="w-full rounded-md bg-pine px-4 py-2.5 text-sm font-medium text-white hover:bg-pine-ink disabled:opacity-50"
        >
          {submitting ? t("registering") : t("register")}
        </button>
      </div>
    </div>
  );
}
