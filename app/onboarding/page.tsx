"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SECTORS } from "@/lib/sectors";

const STEPS = ["Welcome", "Profile", "Sectors", "Guidelines"] as const;

const GUIDELINES = [
  "Be specific. Real asks and real offers — this is a working room, not a broadcast channel.",
  "Vouch carefully. Every business you add to your team reflects on you as the owner.",
  "Keep deals honest. Misrepresenting a business or listing gets one warning, then removal.",
  "Respect both sides of the corridor. Two countries, one community.",
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [country, setCountry] = useState<"us" | "nepal">("us");
  const [city, setCity] = useState("");
  const [sectors, setSectors] = useState<string[]>([]);
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
        setSectors(data.sectors ?? []);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSector(slug: string) {
    setSectors((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  const canNext = step === 1 ? name.trim().length > 0 : step === 3 ? agreed : true;

  async function finish() {
    if (!userId) return;
    setSaving(true);
    await supabase.from("profiles").update({ name, city, country, sectors }).eq("id", userId);
    setSaving(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <p className="eyebrow text-ink-soft">Getting started</p>
          <p className="text-xs text-ink-soft">
            Step {step + 1} of {STEPS.length}
          </p>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-pine transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-lg border border-line bg-white p-6">
        {step === 0 && (
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              You&apos;re in. Welcome to BridgeLink.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              The verified network of the US–Nepal corridor — business owners,
              investors, diplomats, and senior professionals. Three quick steps and
              you&apos;re set up. You can browse right away; verifying your profile
              later unlocks posting and messaging.
            </p>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Set up your profile</h1>
            <p className="mt-1 text-sm text-ink-soft">
              This is how members recognize you. Real names work best here.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="eyebrow text-ink-soft">Full name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
                />
              </label>
              <label className="block text-sm">
                <span className="eyebrow text-ink-soft">Country</span>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value as "us" | "nepal")}
                  className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
                >
                  <option value="us">United States</option>
                  <option value="nepal">Nepal</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="eyebrow text-ink-soft">City</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-pine"
                />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-lg font-semibold tracking-tight">What describes you?</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Pick every channel that fits — you can belong to more than one, and
              change this later from your profile.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SECTORS.map((s) => {
                const active = sectors.includes(s.slug);
                return (
                  <button
                    key={s.slug}
                    onClick={() => toggleSector(s.slug)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                      active
                        ? "border-pine bg-pine-soft text-pine-ink"
                        : "border-line text-ink-soft hover:bg-mist"
                    }`}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-lg font-semibold tracking-tight">How this room works</h1>
            <ul className="mt-3 space-y-2.5">
              {GUIDELINES.map((g, i) => (
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
              I&apos;ve read these and I&apos;m in.
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
          <ArrowLeft size={15} /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="flex items-center gap-1 rounded-md bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-ink disabled:opacity-40"
          >
            Continue <ArrowRight size={15} />
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={!canNext || saving}
            className="rounded-md bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine-ink disabled:opacity-50"
          >
            {saving ? "Saving…" : "Enter BridgeLink"}
          </button>
        )}
      </div>
    </div>
  );
}
