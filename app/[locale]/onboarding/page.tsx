"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [country, setCountry] = useState<"us" | "nepal">("us");
  const [city, setCity] = useState("");
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviteResult, setInviteResult] = useState<"none" | "joined" | "invalid">("none");

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
      const invite = searchParams.get("invite");
      if (invite) {
        const { data: ok } = await supabase.rpc("redeem_business_invite", { invite_id: invite });
        setInviteResult(ok ? "joined" : "invalid");
      }
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
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((step + 1) / STEP_COUNT) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white p-6">
        {step === 0 && (
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {t("welcomeTitle")}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
{t("welcomeBody")}
            </p>
            {inviteResult === "joined" && (
              <p className="mt-3 rounded-md border border-border bg-active-soft p-3 text-sm text-active">
                {t("inviteJoined")}
              </p>
            )}
            {inviteResult === "invalid" && (
              <p className="mt-3 rounded-md border border-dashed border-border bg-bg p-3 text-sm text-ink-soft">
                {t("inviteInvalid")}
              </p>
            )}
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
                  className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
                />
              </label>
              <label className="block text-sm">
                <span className="eyebrow text-ink-soft">{t("country")}</span>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value as "us" | "nepal")}
                  className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
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
                  className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
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
                        ? "border-primary bg-primary-soft text-primary-pressed"
                        : "border-border text-ink-soft hover:bg-bg"
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
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary-soft text-[10px] font-bold text-primary">
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
                className="h-4 w-4 accent-primary"
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
            className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-pressed disabled:opacity-40"
          >
            {t("continue")} <ArrowRight size={15} />
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={!canNext || saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-pressed disabled:opacity-50"
          >
            {saving ? t("saving") : t("enter")}
          </button>
        )}
      </div>
    </div>
  );
}
