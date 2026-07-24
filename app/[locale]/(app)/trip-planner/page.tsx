"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Map, Plus, Trash2, ChevronDown, ChevronUp, ArrowRight, ArrowLeft, MessagesSquare, X, PartyPopper } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/lib/store";
import { useInterests } from "@/lib/useInterests";
import type { InterestSlug } from "@/lib/interests";
import { budgetBreakdown as computeBudgetBreakdown, type RecommendationCategory } from "@/lib/tripPlannerData";
import {
  DIRECTIONS,
  ISO_COUNTRIES,
  directionEndpoints,
  destinationCountryFor,
  offeringTypeToCategory,
  matchOfferings,
  festivalsOverlappingRange,
  applyOfferingFilters,
  PEAK_FESTIVALS,
  type OfferingFilters,
} from "@/lib/tripPlanner";
import {
  pickFestivalName,
  formatMoney,
  OFFERING_TYPES,
  SEASONS,
  type Festival,
  type Offering,
  type DirectionTag,
} from "@/lib/offerings";
import { trustTier } from "@/lib/trust";
import { findOrCreateThread } from "@/lib/threads";
import Avatar from "@/components/Avatar";
import TrustBadge from "@/components/TrustBadge";
import OfferingCard, { type OfferingCardProvider } from "@/components/OfferingCard";

const ADMIN_FALLBACK_ID =
  process.env.NEXT_PUBLIC_SUPPORT_ADMIN_ID || "1258b010-291b-434c-a6a4-a1f6fee0d9b9";

type OfferingRow = Offering & {
  businesses?: { id: string; name: string; logo_url: string | null; owner_user_id: string; verification_status: string } | null;
  profiles?: { id: string; name: string | null; avatar_url: string | null; verification_status: string; bridge: boolean | null } | null;
};

type StagedItem = {
  key: string;
  title: string;
  category: RecommendationCategory;
  estimated_cost: number;
  currency: string;
  notes: string;
  day: number;
  offering_id?: string | null;
  business_id?: string | null;
  providerName?: string | null;
};

type SavedItinerary = {
  id: string; title: string; start_date: string | null; end_date: string | null;
  group_size: number | null; budget_amount: number | null; budget_currency: string; created_at: string;
};
type SavedItem = {
  id: string; title: string; category: string | null; estimated_cost: number | null; currency: string;
  notes: string | null; day: number; offering_id: string | null;
  businesses: { id: string; name: string } | { id: string; name: string }[] | null;
};

export default function TripPlannerPage() {
  const t = useTranslations("tripPlanner");
  const tOff = useTranslations("offerings");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const supabase = createClient();
  const { view } = useApp();
  const interests = useInterests();
  const router = useRouter();

  const [step, setStep] = useState(1);

  // Step 1 — direction
  const [direction, setDirection] = useState<DirectionTag | "">("");
  const [otherOrigin, setOtherOrigin] = useState("");
  const [otherDest, setOtherDest] = useState("");

  // Step 2 — when + who
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [groupSize, setGroupSize] = useState(2);
  const [budgetAmount, setBudgetAmount] = useState(1000);
  const [budgetCurrency, setBudgetCurrency] = useState<"USD" | "NPR">("USD");
  const [selectedInterests, setSelectedInterests] = useState<InterestSlug[]>([]);

  // Step 3 — providers
  const [offerings, setOfferings] = useState<OfferingRow[]>([]);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [festivalNames, setFestivalNames] = useState<Record<string, string>>({});
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [canPublish, setCanPublish] = useState(false);
  const [advisorId, setAdvisorId] = useState<string>(ADMIN_FALLBACK_ID);

  // Step 3 — filters + compare tray
  const EMPTY_FILTERS: OfferingFilters = { type: "", season: "", festival: "", priceMin: "", priceMax: "" };
  const [filters, setFilters] = useState<OfferingFilters>(EMPTY_FILTERS);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  // Step 4 — itinerary
  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [customTitle, setCustomTitle] = useState("");
  const [customCat, setCustomCat] = useState<RecommendationCategory>("activity");
  const [customCost, setCustomCost] = useState("");
  const [customDay, setCustomDay] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saved
  const [savedItineraries, setSavedItineraries] = useState<SavedItinerary[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, SavedItem[]>>({});

  const destinationCountry = destinationCountryFor(direction, otherDest);

  // Load published offerings (with provider embeds), festivals, publish-eligibility,
  // and a travel advisor to route "Talk to a travel advisor" to.
  useEffect(() => {
    async function load() {
      setLoadingOfferings(true);
      const { data: { user } } = await supabase.auth.getUser();
      const [{ data: offs }, { data: fests }, advisor, mine] = await Promise.all([
        supabase
          .from("offerings")
          .select("*, businesses:business_id(id,name,logo_url,owner_user_id,verification_status), profiles:profile_id(id,name,avatar_url,verification_status,bridge)")
          .eq("status", "published")
          .order("created_at", { ascending: false }),
        supabase.from("festivals").select("*"),
        supabase
          .from("profiles")
          .select("id")
          .contains("sectors", ["tourism-hospitality"])
          .eq("verification_status", "verified")
          .limit(5),
        user ? supabase.from("profiles").select("sectors").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setOfferings((offs as OfferingRow[]) ?? []);
      setFestivals((fests as Festival[]) ?? []);
      const fmap: Record<string, string> = {};
      for (const f of (fests as Festival[]) ?? []) fmap[f.slug] = pickFestivalName(locale, f);
      setFestivalNames(fmap);
      const advisorRow = (advisor.data ?? []).find((r: { id: string }) => r.id !== user?.id);
      if (advisorRow) setAdvisorId(advisorRow.id);
      const sectors = ((mine.data as { sectors?: string[] } | null)?.sectors) ?? [];
      setCanPublish(sectors.includes("tourism-hospitality"));
      setLoadingOfferings(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    loadSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function providerOf(o: OfferingRow): OfferingCardProvider {
    if (o.owner_type === "business") {
      const b = Array.isArray(o.businesses) ? o.businesses[0] : o.businesses;
      return {
        name: b?.name ?? t("provider"),
        avatarUrl: b?.logo_url,
        tier: trustTier({ verification_status: b?.verification_status }),
        ownerType: "business",
        subjectId: o.business_id ?? "",
      };
    }
    const p = Array.isArray(o.profiles) ? o.profiles[0] : o.profiles;
    return {
      name: p?.name ?? t("provider"),
      avatarUrl: p?.avatar_url,
      tier: trustTier(p),
      ownerType: "profile",
      subjectId: o.profile_id ?? "",
    };
  }

  const matched = useMemo(
    () => matchOfferings(offerings as Offering[], { direction, destinationCountry, startDate, endDate }, selectedInterests),
    [offerings, direction, destinationCountry, startDate, endDate, selectedInterests],
  );
  const visible = useMemo(() => applyOfferingFilters(matched, filters), [matched, filters]);
  const filtersActive = filters.type || filters.season || filters.festival || filters.priceMin || filters.priceMax;

  // Festivals whose window overlaps the chosen dates (Step 2 overlay).
  const festMatches = useMemo(
    () => festivalsOverlappingRange(festivals, startDate, endDate),
    [festivals, startDate, endDate],
  );
  const peakAdvisory =
    destinationCountry === "np" && festMatches.some((m) => PEAK_FESTIVALS.includes(m.festival.slug));

  const compareList = useMemo(
    () => compareIds.map((id) => offerings.find((o) => o.id === id)).filter((o): o is OfferingRow => !!o),
    [compareIds, offerings],
  );
  function toggleCompare(id: string) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id],
    );
  }

  const budgetSplit = useMemo(() => computeBudgetBreakdown(budgetAmount), [budgetAmount]);
  const plannedTotal = useMemo(() => staged.reduce((s, i) => s + (i.estimated_cost || 0), 0), [staged]);
  const days = useMemo(() => Array.from(new Set(staged.map((s) => s.day))).sort((a, b) => a - b), [staged]);

  function toggleInterest(slug: InterestSlug) {
    setSelectedInterests((p) => (p.includes(slug) ? p.filter((i) => i !== slug) : [...p, slug]));
  }

  function addOffering(o: OfferingRow, provider: OfferingCardProvider) {
    const key = `off-${o.id}`;
    if (staged.some((s) => s.key === key)) return;
    setStaged((prev) => [
      ...prev,
      {
        key,
        title: o.title,
        category: offeringTypeToCategory(o.type),
        estimated_cost: o.price_from ?? 0,
        currency: o.price_currency,
        notes: [o.region, o.country ? tOff(`country.${o.country}`) : null].filter(Boolean).join(" · "),
        day: 1,
        offering_id: o.id,
        business_id: o.business_id,
        providerName: provider.name,
      },
    ]);
  }

  function addCustom() {
    if (!customTitle.trim()) return;
    setStaged((prev) => [
      ...prev,
      {
        key: `custom-${prev.length}-${customTitle.slice(0, 8)}`,
        title: customTitle.trim(),
        category: customCat,
        estimated_cost: Number(customCost) || 0,
        currency: budgetCurrency,
        notes: "",
        day: Math.max(1, customDay),
      },
    ]);
    setCustomTitle(""); setCustomCost("");
  }

  function setItemDay(key: string, day: number) {
    setStaged((prev) => prev.map((s) => (s.key === key ? { ...s, day: Math.max(1, day) } : s)));
  }
  function removeStaged(key: string) {
    setStaged((prev) => prev.filter((s) => s.key !== key));
  }

  async function askAdvisor() {
    const threadId = await findOrCreateThread(advisorId);
    if (threadId) router.push(`/messages/${threadId}?draft=${encodeURIComponent(t("advisorPrefill"))}`);
  }

  async function loadSaved() {
    setLoadingSaved(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingSaved(false); return; }
    const { data } = await supabase
      .from("itineraries")
      .select("id, title, start_date, end_date, group_size, budget_amount, budget_currency, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setSavedItineraries(data ?? []);
    setLoadingSaved(false);
  }

  async function saveItinerary() {
    if (!title.trim()) { setError(t("titleRequired")); return; }
    setError(null); setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const endpoints = directionEndpoints(direction);
    const origin = direction === "other" ? otherOrigin || null : endpoints.origin;
    const destination = direction === "other" ? otherDest || null : endpoints.destination;

    const { data: itinerary, error: insertError } = await supabase
      .from("itineraries")
      .insert({
        user_id: user.id,
        title: title.trim(),
        view,
        start_date: startDate || null,
        end_date: endDate || null,
        group_size: groupSize,
        budget_amount: budgetAmount,
        budget_currency: budgetCurrency,
        interests: selectedInterests,
        direction: direction || null,
        origin_country: origin,
        destination_country: destination,
      })
      .select()
      .single();

    if (insertError || !itinerary) {
      setError(insertError?.message ?? t("saveError"));
      setSaving(false);
      return;
    }

    if (staged.length > 0) {
      await supabase.from("itinerary_items").insert(
        staged.map((s, idx) => ({
          itinerary_id: itinerary.id,
          day: s.day,
          title: s.title,
          category: s.category,
          estimated_cost: s.estimated_cost,
          currency: s.currency,
          notes: s.notes || null,
          sort_order: idx,
          offering_id: s.offering_id ?? null,
          business_id: s.business_id ?? null,
        })),
      );
    }

    setStaged([]); setTitle(""); setSaving(false); setStep(1);
    await loadSaved();
  }

  async function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!expandedItems[id]) {
      const { data } = await supabase
        .from("itinerary_items")
        .select("id, title, category, estimated_cost, currency, notes, day, offering_id, businesses:business_id ( id, name )")
        .eq("itinerary_id", id)
        .order("day").order("sort_order");
      setExpandedItems((prev) => ({ ...prev, [id]: (data as SavedItem[] | null) ?? [] }));
    }
  }

  async function deleteItinerary(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    await supabase.from("itineraries").delete().eq("id", id);
    setSavedItineraries((prev) => prev.filter((i) => i.id !== id));
  }

  const categoryLabel = (cat: string) =>
    ({ stay: t("categoryStay"), activity: t("categoryActivity"), transport: t("categoryTransport"), food: t("categoryFood"), other: t("categoryOther") })[cat] ?? cat;

  const fmtShort = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(d);
  };
  const festWindowLabel = (m: (typeof festMatches)[number]) =>
    m.overlap === "month" || m.overlap === null
      ? (m.festival.month_hint ?? "")
      : `${fmtShort(m.overlap.start)} – ${fmtShort(m.overlap.end)}`;
  function jumpToFestival(slug: string) {
    setFilters({ ...EMPTY_FILTERS, festival: slug });
    setStep(3);
  }

  const steps = [t("stepDirection"), t("stepWhen"), t("stepProviders"), t("stepItinerary")];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <Map size={20} />
        </span>
        <div>
          <p className="eyebrow text-primary">{t("phaseEyebrow")}</p>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex flex-wrap gap-1.5">
        {steps.map((label, i) => {
          const n = i + 1;
          return (
            <button
              key={label}
              onClick={() => setStep(n)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                step === n ? "bg-primary text-on-primary" : "bg-surface-2 text-ink-soft hover:text-ink"
              }`}
            >
              <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${step === n ? "bg-on-primary text-primary" : "bg-border text-ink"}`}>{n}</span>
              {label}
            </button>
          );
        })}
      </div>

      {/* STEP 1 — Direction */}
      {step === 1 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">{t("directionQuestion")}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {DIRECTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                aria-pressed={direction === d}
                className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  direction === d ? "border-primary bg-primary-soft text-primary-pressed" : "border-border text-ink hover:bg-bg"
                }`}
              >
                {tOff(`directions.${d}`)}
              </button>
            ))}
          </div>

          {direction === "other" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="eyebrow text-ink-soft">{t("originCountry")}</span>
                <select value={otherOrigin} onChange={(e) => setOtherOrigin(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm">
                  <option value="">{t("selectCountry")}</option>
                  {ISO_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="eyebrow text-ink-soft">{t("destinationCountry")}</span>
                <select value={otherDest} onChange={(e) => setOtherDest(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm">
                  <option value="">{t("selectCountry")}</option>
                  {ISO_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </label>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <button onClick={() => setStep(2)} disabled={!direction}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50">
              {t("next")} <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 — When + who */}
      {step === 2 && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold">{t("whenWhoTitle")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="eyebrow text-ink-soft">{t("titleLabel")}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")}
                className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary" />
            </label>
            <label className="block text-sm">
              <span className="eyebrow text-ink-soft">{t("startDate")}</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm">
              <span className="eyebrow text-ink-soft">{t("endDate")}</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm">
              <span className="eyebrow text-ink-soft">{t("groupSize")}</span>
              <input type="number" min={1} value={groupSize} onChange={(e) => setGroupSize(Math.max(1, Number(e.target.value)))} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <label className="block text-sm">
                <span className="eyebrow text-ink-soft">{t("budget")}</span>
                <input type="number" min={0} value={budgetAmount} onChange={(e) => setBudgetAmount(Math.max(0, Number(e.target.value)))} className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm" />
              </label>
              <label className="block text-sm">
                <span className="eyebrow text-ink-soft">{t("currency")}</span>
                <select value={budgetCurrency} onChange={(e) => setBudgetCurrency(e.target.value as "USD" | "NPR")} className="mt-1 rounded-md border border-border bg-surface px-2 py-2 text-sm">
                  <option>USD</option><option>NPR</option>
                </select>
              </label>
            </div>
          </div>

          <div className="mt-3">
            <span className="eyebrow text-ink-soft">{t("interests")}</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {interests.map((i) => {
                const active = selectedInterests.includes(i.slug);
                return (
                  <button key={i.slug} onClick={() => toggleInterest(i.slug)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${active ? "border-primary bg-primary-soft text-primary-pressed" : "border-border text-ink-soft hover:bg-bg"}`}>
                    {i.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Festival overlay — dates overlapping seeded festivals */}
          {festMatches.length > 0 && (
            <div className="mt-4 rounded-md border border-bridge bg-bridge-soft p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
                <PartyPopper size={15} className="text-bridge" aria-hidden /> {t("festivalOverlapTitle")}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {festMatches.map((m) => (
                  <button key={m.festival.slug} onClick={() => jumpToFestival(m.festival.slug)}
                    className="rounded-full bg-bridge-soft px-2.5 py-1 text-[12px] font-medium text-on-bridge hover:opacity-90">
                    {pickFestivalName(locale, m.festival)}
                    {festWindowLabel(m) && <span className="font-normal opacity-80"> ({festWindowLabel(m)})</span>}
                  </button>
                ))}
              </div>
              {peakAdvisory && <p className="mt-2 text-[13px] text-ink-soft">{t("peakAdvisory")}</p>}
            </div>
          )}

          <div className="mt-4 flex justify-between">
            <button onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2"><ArrowLeft size={15} /> {t("back")}</button>
            <button onClick={() => setStep(3)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-pressed">{t("next")} <ArrowRight size={15} /></button>
          </div>
        </div>
      )}

      {/* STEP 3 — From our providers */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{t("providersTitle")}</h2>
              <button onClick={askAdvisor} className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-surface-2">
                <MessagesSquare size={14} /> {t("askAdvisor")}
              </button>
            </div>

            {/* Filter row — on top of the direction/date matching */}
            {!loadingOfferings && matched.length > 0 && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="text-xs text-ink-soft">
                  <span className="block">{t("filterType")}</span>
                  <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
                    className="mt-0.5 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink">
                    <option value="">{t("anyType")}</option>
                    {OFFERING_TYPES.map((ty) => <option key={ty} value={ty}>{tOff(`types.${ty}`)}</option>)}
                  </select>
                </label>
                <label className="text-xs text-ink-soft">
                  <span className="block">{t("filterSeason")}</span>
                  <select value={filters.season} onChange={(e) => setFilters((f) => ({ ...f, season: e.target.value }))}
                    className="mt-0.5 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink">
                    <option value="">{t("anySeason")}</option>
                    {SEASONS.map((s) => <option key={s} value={s}>{tOff(`seasons.${s}`)}</option>)}
                  </select>
                </label>
                <label className="text-xs text-ink-soft">
                  <span className="block">{t("filterFestival")}</span>
                  <select value={filters.festival} onChange={(e) => setFilters((f) => ({ ...f, festival: e.target.value }))}
                    className="mt-0.5 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink">
                    <option value="">{t("anyFestival")}</option>
                    {festivals.map((f) => <option key={f.slug} value={f.slug}>{pickFestivalName(locale, f)}</option>)}
                  </select>
                </label>
                <label className="text-xs text-ink-soft">
                  <span className="block">{t("filterPrice")}</span>
                  <span className="mt-0.5 flex gap-1">
                    <input type="number" min={0} value={filters.priceMin} onChange={(e) => setFilters((f) => ({ ...f, priceMin: e.target.value }))} placeholder={t("min")} className="w-20 rounded-md border border-border-input px-2 py-1.5 text-sm" />
                    <input type="number" min={0} value={filters.priceMax} onChange={(e) => setFilters((f) => ({ ...f, priceMax: e.target.value }))} placeholder={t("max")} className="w-20 rounded-md border border-border-input px-2 py-1.5 text-sm" />
                  </span>
                </label>
                {filtersActive && (
                  <button onClick={() => setFilters(EMPTY_FILTERS)} className="rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-ink hover:bg-surface-2">
                    {t("clearFilters")}
                  </button>
                )}
              </div>
            )}

            {loadingOfferings ? (
              <p className="mt-3 text-sm text-ink-soft">{t("loading")}</p>
            ) : matched.length === 0 ? (
              <div className="mt-3 rounded-md border border-dashed border-border p-4 text-sm">
                <p className="text-ink">{t("noMatches")}</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  <Link href="/members" className="font-medium text-primary hover:underline">{t("browseDirectory")}</Link>
                  {canPublish && <Link href="/offerings/new" className="font-medium text-primary hover:underline">{t("publishFirst")}</Link>}
                </div>
              </div>
            ) : visible.length === 0 ? (
              <div className="mt-3 rounded-md border border-dashed border-border p-4 text-sm">
                <p className="text-ink">{t("noFilterMatches")}</p>
                <button onClick={() => setFilters(EMPTY_FILTERS)} className="mt-1.5 font-medium text-primary hover:underline">{t("clearFilters")}</button>
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {visible.map((o) => {
                  const row = o as OfferingRow;
                  const provider = providerOf(row);
                  const isAdded = staged.some((s) => s.key === `off-${o.id}`);
                  const isSelected = compareIds.includes(o.id);
                  return (
                    <div key={o.id} className="space-y-2">
                      <OfferingCard
                        offering={o}
                        provider={provider}
                        festivalNames={festivalNames}
                        selectable
                        selected={isSelected}
                        onToggleSelect={() => toggleCompare(o.id)}
                      />
                      <button onClick={() => addOffering(row, provider)} disabled={isAdded}
                        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-bg disabled:opacity-40">
                        {isAdded ? t("added") : <><Plus size={14} /> {t("addToItinerary")}</>}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2"><ArrowLeft size={15} /> {t("back")}</button>
            <button onClick={() => setStep(4)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-pressed">{t("next")} <ArrowRight size={15} /></button>
          </div>

          {/* Sticky compare tray */}
          {compareIds.length > 0 && (
            <div className="sticky bottom-3 z-10 flex items-center gap-2 rounded-lg border border-border bg-surface p-2.5 shadow-card">
              <span className="text-sm font-medium text-ink">{t("compareCount", { count: compareIds.length })}</span>
              <span className="text-[11px] text-ink-soft">{t("compareMax")}</span>
              <button onClick={() => setShowCompare(true)} disabled={compareIds.length < 2}
                className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-on-primary hover:bg-primary-pressed disabled:opacity-50">
                {t("compare")}
              </button>
              <button onClick={() => setCompareIds([])} className="rounded-md border border-border px-2.5 py-1.5 text-[13px] font-medium text-ink hover:bg-surface-2">
                {t("compareClear")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Compare panel */}
      {showCompare && compareList.length > 0 && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-2 sm:items-center" onClick={() => setShowCompare(false)}>
          <div className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-lg border border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">{t("compareTitle")}</h2>
              <button onClick={() => setShowCompare(false)} aria-label={t("close")} className="ml-auto rounded p-1 text-ink-soft hover:bg-bg"><X size={16} /></button>
            </div>
            <div className="mt-3 overflow-x-auto">
              <div className="flex gap-3" style={{ minWidth: `${compareList.length * 12}rem` }}>
                {compareList.map((o) => {
                  const provider = providerOf(o);
                  const isAdded = staged.some((s) => s.key === `off-${o.id}`);
                  const rows: [string, string][] = [
                    [t("cmpPrice"), formatMoney(o.price_from, o.price_currency) ? `${formatMoney(o.price_from, o.price_currency)} ${tOff(`units.${o.price_unit}`)}` : "—"],
                    [t("cmpDuration"), o.duration_days != null ? t("daysCount", { count: o.duration_days }) : "—"],
                    [t("cmpGroup"), o.group_min != null || o.group_max != null ? `${o.group_min ?? 1}–${o.group_max ?? "∞"}` : "—"],
                    [t("cmpSeasons"), o.seasons.map((s) => tOff(`seasons.${s}`)).join(", ") || "—"],
                    [t("cmpFestivals"), o.festival_slugs.map((f) => festivalNames[f] ?? f).join(", ") || "—"],
                    [t("cmpLocation"), [o.region, o.country ? tOff(`country.${o.country}`) : null].filter(Boolean).join(" · ") || "—"],
                  ];
                  return (
                    <div key={o.id} className="flex w-48 shrink-0 flex-col rounded-md border border-border p-3">
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-chip-ink w-fit">{tOff(`types.${o.type}`)}</span>
                      <Link href={`/offerings/${o.id}`} className="mt-1.5 text-sm font-semibold text-ink hover:underline">{o.title}</Link>
                      <dl className="mt-2 space-y-1.5 text-xs">
                        {rows.map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-[10px] uppercase tracking-wide text-ink-soft">{label}</dt>
                            <dd className="text-ink">{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-2 flex items-center gap-1.5">
                        <Avatar name={provider.name} url={provider.avatarUrl} size={20} shape={provider.ownerType === "business" ? "rounded" : "circle"} />
                        <span className="truncate text-xs font-medium text-ink">{provider.name}</span>
                        <TrustBadge tier={provider.tier} label={provider.tier === "bridge" ? tCommon("bridgeVerified") : provider.ownerType === "business" ? tCommon("verifiedBusiness") : tCommon("verified")} />

                      </div>
                      <button onClick={() => addOffering(o, provider)} disabled={isAdded}
                        className="mt-3 rounded-md border border-border px-2 py-1.5 text-xs font-medium hover:bg-bg disabled:opacity-40">
                        {isAdded ? t("added") : t("addToItinerary")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4 — Itinerary + budget */}
      {step === 4 && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">{t("itineraryTitle")}</h2>
              <button onClick={askAdvisor} className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-surface-2">
                <MessagesSquare size={14} /> {t("askAdvisor")}
              </button>
            </div>

            {staged.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">{t("stagedEmpty")}</p>
            ) : (
              <div className="mt-3 space-y-3">
                {days.map((d) => (
                  <div key={d}>
                    <p className="eyebrow text-ink-soft">{t("dayLabel")} {d}</p>
                    <div className="mt-1.5 space-y-1.5">
                      {staged.filter((s) => s.day === d).map((s) => (
                        <div key={s.key} className="flex items-center gap-2 rounded-md bg-bg px-3 py-2 text-sm">
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">{s.title}</span>
                            {s.offering_id && (
                              <Link href={`/offerings/${s.offering_id}`} className="ml-1.5 rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-chip-ink hover:underline">
                                {s.providerName || t("provider")}
                              </Link>
                            )}
                            <span className="ml-1.5 text-xs text-ink-soft">· {categoryLabel(s.category)} · {s.currency} {s.estimated_cost}</span>
                          </div>
                          <input type="number" min={1} value={s.day} onChange={(e) => setItemDay(s.key, Number(e.target.value))}
                            aria-label={t("dayLabel")} className="w-14 rounded border border-border-input px-2 py-1 text-xs" />
                          <button onClick={() => removeStaged(s.key)} aria-label={t("removeItem")} className="text-ink-soft hover:text-accent"><Trash2 size={14} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Custom item */}
            <div className="mt-4 border-t border-border pt-3">
              <p className="eyebrow text-ink-soft">{t("addCustomTitle")}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder={t("customTitlePlaceholder")}
                  className="min-w-[10rem] flex-1 rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary" />
                <select value={customCat} onChange={(e) => setCustomCat(e.target.value as RecommendationCategory)} className="rounded-md border border-border bg-surface px-2 py-2 text-sm">
                  {(["stay", "activity", "transport", "food", "other"] as const).map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                </select>
                <input type="number" min={0} value={customCost} onChange={(e) => setCustomCost(e.target.value)} placeholder={t("customCost")} className="w-24 rounded-md border border-border-input px-3 py-2 text-sm" />
                <input type="number" min={1} value={customDay} onChange={(e) => setCustomDay(Math.max(1, Number(e.target.value)))} aria-label={t("dayLabel")} className="w-16 rounded-md border border-border-input px-2 py-2 text-sm" />
                <button onClick={addCustom} disabled={!customTitle.trim()} className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-bg disabled:opacity-40">{t("addCustom")}</button>
              </div>
            </div>
          </div>

          {/* Budget breakdown */}
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold">{t("budgetBreakdown")}</h2>
            <div className="mt-3 space-y-2">
              {budgetSplit.map((b) => (
                <div key={b.category} className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">{categoryLabel(b.category)}</span>
                  <span className="font-medium">{budgetCurrency} {b.amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-sm font-medium">
              <span>{t("plannedTotal")}</span>
              <span>{budgetCurrency} {plannedTotal.toLocaleString()}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-ink-soft">
              <span>{t("perDay")}: {budgetCurrency} {startDate && endDate ? Math.round(budgetAmount / Math.max(1, (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)).toLocaleString() : budgetAmount.toLocaleString()}</span>
              <span>{t("perPerson")}: {budgetCurrency} {Math.round(budgetAmount / groupSize).toLocaleString()}</span>
            </div>
          </div>

          {error && <p className="text-sm text-accent" role="alert">{error}</p>}
          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium text-ink hover:bg-surface-2"><ArrowLeft size={15} /> {t("back")}</button>
            <button onClick={saveItinerary} disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50">
              {saving ? t("savingItinerary") : t("saveItinerary")}
            </button>
          </div>
        </div>
      )}

      {/* Saved itineraries */}
      <div>
        <h2 className="mb-2 text-sm font-semibold">{t("myItineraries")}</h2>
        {loadingSaved ? (
          <p className="text-sm text-ink-soft">{t("loading")}</p>
        ) : savedItineraries.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("noItinerariesYet")}</p>
        ) : (
          <div className="space-y-2">
            {savedItineraries.map((it) => {
              const items = expandedItems[it.id] ?? [];
              const total = items.reduce((sum, i) => sum + (i.estimated_cost ?? 0), 0);
              return (
                <div key={it.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-center justify-between">
                    <button onClick={() => toggleExpand(it.id)} className="flex flex-1 items-center gap-2 text-left">
                      {expanded === it.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      <span className="text-sm font-semibold">{it.title}</span>
                      <span className="text-xs text-ink-soft">{it.start_date ?? ""} {it.end_date ? `– ${it.end_date}` : ""}</span>
                    </button>
                    <button onClick={() => deleteItinerary(it.id)} aria-label={t("deleteItinerary")} className="rounded p-1.5 text-ink-soft hover:bg-bg hover:text-accent"><Trash2 size={14} /></button>
                  </div>
                  {expanded === it.id && (
                    <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                      {items.length === 0 ? (
                        <p className="text-xs text-ink-soft">{t("stagedEmpty")}</p>
                      ) : (
                        <>
                          {items.map((i) => {
                            const biz = Array.isArray(i.businesses) ? i.businesses[0] : i.businesses;
                            return (
                              <div key={i.id} className="flex items-center justify-between gap-2 text-xs">
                                <span className="min-w-0 truncate">
                                  <span className="text-ink-soft">{t("dayLabel")} {i.day} · </span>
                                  {i.title}
                                  {i.offering_id ? (
                                    <Link href={`/offerings/${i.offering_id}`} className="ml-1.5 font-medium text-primary hover:text-primary-pressed">{t("viewOffering")}</Link>
                                  ) : biz ? (
                                    <Link href={`/business/${biz.id}`} className="ml-1.5 font-medium text-primary hover:text-primary-pressed">{t("viewBusiness")}</Link>
                                  ) : null}
                                </span>
                                <span className="shrink-0 text-ink-soft">{i.currency} {i.estimated_cost}</span>
                              </div>
                            );
                          })}
                          <div className="flex items-center justify-between border-t border-border pt-1.5 text-xs font-medium">
                            <span>{t("totalEstimated")}</span>
                            <span>USD {total}</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
