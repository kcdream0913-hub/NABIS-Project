"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSectors } from "@/lib/useSectors";

const STEP_COUNT = 4;

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const guidelines = [t("guideline1"), t("guideline2"), t("guideline3"), t("guideline4")];
  const sectors = useSectors();
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [country, setCountry] = useState<"us" | "nepal">("us");
  const [city, setCity] = useState("");
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      const { data } = await supabase
        .from("profiles")
        .select("name, city, country, sectors")
        .eq("id", user.id)
        .single();
      if (data) {
        setName(data.name ?? "");
        setCity(data.city ?? "");
        setCountry((data.country as "us" | "nepal") ?? "us");
        setSelectedSectors(data.sectors ?? []);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSector(slug: string) {
    setSelectedSectors((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  const canNext = step === 1 ? name.trim().length > 0 : step === 3 ? agreed : true;

  async function finish() {
    if (!userId) return;
    setSaving(true);
    await supabase.from("profiles").update({ name, city, country, sectors: selectedSectors }).eq("id", userId);
    setSaving(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow text-ink-soft">{t("gettingStarted")}</p>
          <p className="text-xs text-ink-soft">
            {t("step", { current: step + 1, total: STEP_COUNT })}
          </p>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-pine transition-all"
            style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white p-6">
        {step === 0 && (
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {t("welcomeTitle")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
{t("welcomeBody")}
            </p>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{t("profileTitle")}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {t("profileSubtitle")}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="eyebrow text-ink-soft">{t("fullName")}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("yourNamePlaceholder")}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
                />
              </label>
              <label className="block text-sm">
                <span className="eyebrow text-ink-soft">{t("country")}</span>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value as "us" | "nepal")}
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
                >
                  <option value="us">{t("unitedStates")}</option>
                  <option value="nepal">{t("nepal")}</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="eyebrow text-ink-soft">{t("city")}</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t("cityPlaceholder")}
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
                />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{t("describeTitle")}</h1>
            <p className="mt-1 text-sm text-ink-soft">
{t("describeSubtitle")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {sectors.map((sec) => {
                const active = selectedSectors.includes(sec.slug);
                return (
                  <button
                    key={sec.slug}
                    onClick={() => toggleSector(sec.slug)}
                    title={sec.description}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                      active
                        ? "border-pine bg-pine-soft text-pine-ink"
                        : "border-line text-ink-soft hover:bg-mist"
                    }`}
                  >
                    {sec.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{t("guidelinesTitle")}</h1>
            <ul className="mt-3 space-y-2.5">
              {guidelines.map((g, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-pine-soft text-[10px] font-bold text-pine">
                    {i + 1}
                  </span>
                  {g}
                </li>
              ))}
            </ul>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="h-4 w-4 accent-pine"
              />
              {t("agree")}
            </label>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-ink-soft hover:bg-white disabled:opacity-0"
        >
          <ArrowLeft size={15} /> {t("back")}
        </button>
        {step < STEP_COUNT - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="flex items-center gap-1 rounded-md bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-ink disabled:opacity-40"
          >
            {t("continue")} <ArrowRight size={15} />
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={!canNext || saving}
            className="rounded-md bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-ink disabled:opacity-50"
          >
            {saving ? t("saving") : t("enter")}
          </button>
        )}
      </div>
    </div>
  );
}
