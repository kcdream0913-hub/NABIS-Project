"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Map, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useApp } from "@/lib/store";
import { useInterests } from "@/lib/useInterests";
import type { InterestSlug } from "@/lib/interests";
import {
  recommendationsFor,
  budgetBreakdown as computeBudgetBreakdown,
  type RecommendationCategory,
  type RecommendationTemplate,
} from "@/lib/tripPlannerData";

type StagedItem = {
  key: string;
  title: string;
  category: RecommendationCategory;
  estimated_cost: number;
  notes: string;
  business_id?: string | null; // set when staged from a real directory business
};

type VerifiedBusiness = {
  id: string;
  name: string;
  primary_sector: string | null;
  country_of_registration: string | null;
  bio: string | null;
};

type SavedItinerary = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  group_size: number | null;
  budget_amount: number | null;
  budget_currency: string;
  created_at: string;
};

type SavedItem = {
  id: string;
  title: string;
  category: string | null;
  estimated_cost: number | null;
  currency: string;
  notes: string | null;
  day: number;
  business_id: string | null;
  businesses: { id: string; name: string } | { id: string; name: string }[] | null;
};

export default function TripPlannerPage() {
  const t = useTranslations("tripPlanner");
  const supabase = createClient();
  const { view } = useApp();
  const interests = useInterests();

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [groupSize, setGroupSize] = useState(2);
  const [budgetAmount, setBudgetAmount] = useState(1000);
  const [budgetCurrency, setBudgetCurrency] = useState<"USD" | "NPR">("USD");
  const [selectedInterests, setSelectedInterests] = useState<InterestSlug[]>([]);
  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [verifiedBiz, setVerifiedBiz] = useState<VerifiedBusiness[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [savedItineraries, setSavedItineraries] = useState<SavedItinerary[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, SavedItem[]>>({});

  const recommendations = useMemo(
    () => recommendationsFor(view, selectedInterests),
    [view, selectedInterests]
  );

  // Real, verified directory businesses — linkable recommendations. Degrades
  // gracefully: when the directory is sparse this list is short/empty and the
  // curated templates below carry the planner.
  useEffect(() => {
    async function loadBiz() {
      const { data } = await supabase
        .from("businesses")
        .select("id, name, primary_sector, country_of_registration, bio")
        .eq("verification_status", "verified")
        .order("created_at", { ascending: false })
        .limit(20);
      setVerifiedBiz(data ?? []);
    }
    loadBiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normCountry = (c: string | null): "us" | "nepal" | null => {
    const l = (c ?? "").toLowerCase();
    if (l.includes("nepal") || l === "np") return "nepal";
    if (l.includes("united states") || l === "usa" || l === "us") return "us";
    return null;
  };
  // Bridge = corridor-wide; US/Nepal narrow to that side (matches Directory).
  const bizForView = verifiedBiz.filter(
    (b) => view === "bridge" || normCountry(b.country_of_registration) === view
  );

  const budgetBreakdown = useMemo(() => computeBudgetBreakdown(budgetAmount), [budgetAmount]);

  async function loadSavedItineraries() {
    setLoadingSaved(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoadingSaved(false);
      return;
    }
    const { data } = await supabase
      .from("itineraries")
      .select("id, title, start_date, end_date, group_size, budget_amount, budget_currency, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setSavedItineraries(data ?? []);
    setLoadingSaved(false);
  }

  useEffect(() => {
    loadSavedItineraries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleInterest(slug: InterestSlug) {
    setSelectedInterests((prev) =>
      prev.includes(slug) ? prev.filter((i) => i !== slug) : [...prev, slug]
    );
  }

  function addRecommendation(rec: RecommendationTemplate) {
    if (staged.some((s) => s.key === rec.id)) return;
    setStaged((prev) => [
      ...prev,
      {
        key: rec.id,
        title: rec.title,
        category: rec.category,
        estimated_cost: rec.estimatedCostUSD,
        notes: rec.note,
      },
    ]);
  }

  function addBusiness(b: VerifiedBusiness) {
    const key = `biz-${b.id}`;
    if (staged.some((s) => s.key === key)) return;
    setStaged((prev) => [
      ...prev,
      {
        key,
        title: b.name,
        category: "other",
        estimated_cost: 0,
        notes: b.primary_sector ?? "",
        business_id: b.id,
      },
    ]);
  }

  function removeStaged(key: string) {
    setStaged((prev) => prev.filter((s) => s.key !== key));
  }

  async function saveItinerary() {
    if (!title.trim()) {
      setError(t("titleRequired"));
      return;
    }
    setError(null);
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }

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
      })
      .select()
      .single();

    if (insertError || !itinerary) {
      setError(insertError?.message ?? "Could not save the itinerary.");
      setSaving(false);
      return;
    }

    if (staged.length > 0) {
      await supabase.from("itinerary_items").insert(
        staged.map((s, idx) => ({
          itinerary_id: itinerary.id,
          day: 1,
          title: s.title,
          category: s.category,
          estimated_cost: s.estimated_cost,
          currency: "USD",
          notes: s.notes,
          sort_order: idx,
          business_id: s.business_id ?? null,
        }))
      );
    }

    setStaged([]);
    setTitle("");
    setSaving(false);
    await loadSavedItineraries();
  }

  async function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!expandedItems[id]) {
      const { data } = await supabase
        .from("itinerary_items")
        .select("id, title, category, estimated_cost, currency, notes, day, business_id, businesses:business_id ( id, name )")
        .eq("itinerary_id", id)
        .order("day")
        .order("sort_order");
      setExpandedItems((prev) => ({ ...prev, [id]: (data as SavedItem[] | null) ?? [] }));
    }
  }

  async function deleteItinerary(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    await supabase.from("itineraries").delete().eq("id", id);
    setSavedItineraries((prev) => prev.filter((i) => i.id !== id));
  }

  const categoryLabel = (cat: string) =>
    ({
      stay: t("categoryStay"),
      activity: t("categoryActivity"),
      transport: t("categoryTransport"),
      food: t("categoryFood"),
      other: t("categoryOther"),
    })[cat] ?? cat;

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

      <p className="rounded-md border border-dashed border-border bg-bg p-3 text-sm text-ink-soft">
        {t("bookingNotice")}
      </p>

      {/* Inputs */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="eyebrow text-ink-soft">{t("titleLabel")}</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
              className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
            />
          </label>
          <label className="block text-sm">
            <span className="eyebrow text-ink-soft">{t("startDate")}</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="eyebrow text-ink-soft">{t("endDate")}</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="eyebrow text-ink-soft">{t("groupSize")}</span>
            <input
              type="number"
              min={1}
              value={groupSize}
              onChange={(e) => setGroupSize(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <label className="block text-sm">
              <span className="eyebrow text-ink-soft">{t("budget")}</span>
              <input
                type="number"
                min={0}
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(Math.max(0, Number(e.target.value)))}
                className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="eyebrow text-ink-soft">{t("currency")}</span>
              <select
                value={budgetCurrency}
                onChange={(e) => setBudgetCurrency(e.target.value as "USD" | "NPR")}
                className="mt-1 rounded-md border border-border bg-surface px-2 py-2 text-sm"
              >
                <option>USD</option>
                <option>NPR</option>
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
                <button
                  key={i.slug}
                  onClick={() => toggleInterest(i.slug)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    active ? "border-primary bg-primary-soft text-primary-pressed" : "border-border text-ink-soft hover:bg-bg"
                  }`}
                >
                  {i.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Budget breakdown */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">{t("budgetBreakdown")}</h2>
        <div className="mt-3 space-y-2">
          {budgetBreakdown.map((b) => (
            <div key={b.category} className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">{categoryLabel(b.category)}</span>
              <span className="font-medium">
                {budgetCurrency} {b.amount.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs text-ink-soft">
          <span>
            {t("perDay")}: {budgetCurrency}{" "}
            {startDate && endDate
              ? Math.round(
                  budgetAmount /
                    Math.max(1, (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
                ).toLocaleString()
              : budgetAmount.toLocaleString()}
          </span>
          <span>
            {t("perPerson")}: {budgetCurrency} {Math.round(budgetAmount / groupSize).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Recommendations */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">{t("recommendationsTitle")}</h2>
        <p className="mt-0.5 text-xs text-ink-soft">{t("recommendationsHint")}</p>

        {bizForView.length > 0 && (
          <div className="mt-3">
            <p className="eyebrow text-ink-soft">{t("verifiedBusinessesTitle")}</p>
            <div className="mt-1.5 space-y-2">
              {bizForView.map((b) => {
                const key = `biz-${b.id}`;
                const isAdded = staged.some((s) => s.key === key);
                return (
                  <div key={b.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{b.name}</p>
                      {b.primary_sector && <p className="mt-0.5 text-xs text-ink-soft">{b.primary_sector}</p>}
                      <Link
                        href={`/business/${b.id}`}
                        className="mt-1 inline-block text-xs font-medium text-primary hover:text-primary-pressed"
                      >
                        {t("viewBusiness")}
                      </Link>
                    </div>
                    <button
                      onClick={() => addBusiness(b)}
                      disabled={isAdded}
                      className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-bg disabled:opacity-40"
                    >
                      {isAdded ? t("added") : <><Plus size={12} /> {t("addToItinerary")}</>}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {recommendations.map((r) => {
            const isAdded = staged.some((s) => s.key === r.id);
            return (
              <div key={r.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {categoryLabel(r.category)} · ~USD {r.estimatedCostUSD}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">{r.note}</p>
                </div>
                <button
                  onClick={() => addRecommendation(r)}
                  disabled={isAdded}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-bg disabled:opacity-40"
                >
                  {isAdded ? t("added") : <><Plus size={12} /> {t("addToItinerary")}</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Staged itinerary */}
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold">{t("stagedTitle")}</h2>
        {staged.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">{t("stagedEmpty")}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {staged.map((s) => (
              <div key={s.key} className="flex items-center justify-between rounded-md bg-bg px-3 py-2 text-sm">
                <span>{s.title}</span>
                <button onClick={() => removeStaged(s.key)} className="text-ink-soft hover:text-accent">
                  {t("removeItem")}
                </button>
              </div>
            ))}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-accent">{error}</p>}
        <button
          onClick={saveItinerary}
          disabled={saving}
          className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50"
        >
          {saving ? t("savingItinerary") : t("saveItinerary")}
        </button>
      </div>

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
                    <button
                      onClick={() => toggleExpand(it.id)}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      {expanded === it.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      <span className="text-sm font-semibold">{it.title}</span>
                      <span className="text-xs text-ink-soft">
                        {it.start_date ?? ""} {it.end_date ? `– ${it.end_date}` : ""}
                      </span>
                    </button>
                    <button
                      onClick={() => deleteItinerary(it.id)}
                      aria-label={t("deleteItinerary")}
                      className="rounded p-1.5 text-ink-soft hover:bg-bg hover:text-accent"
                    >
                      <Trash2 size={14} />
                    </button>
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
                                  {i.title}
                                  {biz && (
                                    <Link
                                      href={`/business/${biz.id}`}
                                      className="ml-1.5 font-medium text-primary hover:text-primary-pressed"
                                    >
                                      {t("viewBusiness")}
                                    </Link>
                                  )}
                                </span>
                                <span className="shrink-0 text-ink-soft">
                                  {i.currency} {i.estimated_cost}
                                </span>
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

      <p className="text-sm text-ink-soft">
        {t("postHintPrefix")}{" "}
        <Link href="/channels" className="font-medium text-primary hover:text-primary-pressed">
          {t("travelPlans")}
        </Link>{" "}
        {t("postHintSuffix")}
      </p>
    </div>
  );
}
