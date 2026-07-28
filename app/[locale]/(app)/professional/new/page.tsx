"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSectors } from "@/lib/useSectors";
import type { PolicyTrack } from "@/lib/kyc";
import { buildProfileUpdate, buildVerificationRecord, TRACK_COUNTRY } from "@/lib/professionalRegistration";

// Professional (individual) registration — BL-NAV-01 fix 6. Mirrors business/new:
// a Step 0 country fork chooses the policy_track (US / Nepal) the same way, then a
// form writes member-editable fields to profiles and self-attested evidence to
// verification_records (subject_type='user', status='pending'). The track column on
// profiles is deliberately NOT written here — it is pinned by trg_protect_profile_trust
// and is set by admin review of the verification_records row (see lib/professionalRegistration).
export default function NewProfessionalPage() {
  const t = useTranslations("professional");
  const router = useRouter();
  const supabase = createClient();
  const sectors = useSectors();

  const [track, setTrack] = useState<PolicyTrack | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [headline, setHeadline] = useState("");
  const [city, setCity] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [profession, setProfession] = useState("");
  const [attestation, setAttestation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Prefill from the current profile so this edits rather than blanks it.
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUid(user.id);
      const { data } = await supabase.from("profiles").select("name, bio, city, sectors").eq("id", user.id).single();
      if (data) {
        if (data.name && data.name !== user.email) setName(data.name);
        setHeadline(data.bio ?? "");
        setCity(data.city ?? "");
        setSelected(Array.isArray(data.sectors) ? (data.sectors as string[]) : []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleSector(slug: string) {
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  const canSubmit = !!track && !!name.trim() && !!headline.trim() && !!profession.trim() && !!attestation.trim();

  async function submit() {
    if (!uid || !track) return;
    setError(null);
    setSubmitting(true);
    const { error: pErr } = await supabase
      .from("profiles")
      .update(buildProfileUpdate({ name, headline, city, sectors: selected }))
      .eq("id", uid);
    if (pErr) {
      setError(t("saveError"));
      setSubmitting(false);
      return;
    }
    const { error: vErr } = await supabase
      .from("verification_records")
      .insert(buildVerificationRecord(uid, track, { profession, attestation }));
    setSubmitting(false);
    if (vErr) {
      setError(t("saveError"));
      return;
    }
    setDone(true);
  }

  // --- Success ---
  if (done) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-active-soft text-active">
          <ShieldCheck size={26} />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">{t("submittedTitle")}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t("submittedBody")}</p>
        <button
          onClick={() => router.push("/profile")}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-pressed"
        >
          {t("goToProfile")}
        </button>
      </div>
    );
  }

  // --- Step 0: country fork (chooses policy_track) ---
  if (!track) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("forkQuestion")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t("forkSubtitle")}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setTrack("us")}
            className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-xl border border-border-input bg-surface p-5 text-center hover:border-primary hover:bg-surface-2"
          >
            <span className="text-3xl" aria-hidden>🇺🇸</span>
            <span className="text-base font-semibold text-ink">{t("forkUS")}</span>
          </button>
          <button
            type="button"
            onClick={() => setTrack("nepal")}
            className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-xl border border-border-input bg-surface p-5 text-center hover:border-primary hover:bg-surface-2"
          >
            <span className="text-3xl" aria-hidden>🇳🇵</span>
            <span className="text-base font-semibold text-ink">{t("forkNepal")}</span>
          </button>
        </div>
        <p className="mt-4 text-xs text-ink-soft">{t("forkElsewhere")}</p>
      </div>
    );
  }

  // --- Form ---
  const label = "block text-sm";
  const eyebrow = "eyebrow text-ink-soft";
  const input = "mt-1 w-full rounded-md border border-border-input bg-surface px-3 py-2 text-sm focus:border-primary";

  return (
    <div className="mx-auto max-w-md">
      <button onClick={() => setTrack(null)} className="mb-3 text-sm font-medium text-ink-soft hover:text-ink">
        ← {t("back")}
      </button>
      <p className={eyebrow}>{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-ink-soft">{t("trackChosen", { country: TRACK_COUNTRY[track] })}</p>

      <div className="mt-5 space-y-4">
        <label className={label}>
          <span className={eyebrow}>{t("nameLabel")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} className={input} />
        </label>
        <label className={label}>
          <span className={eyebrow}>{t("headlineLabel")}</span>
          <textarea value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={t("headlinePlaceholder")} rows={3} className={input} />
        </label>
        <label className={label}>
          <span className={eyebrow}>{t("cityLabel")}</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t("cityPlaceholder")} className={input} />
        </label>

        <div>
          <span className={eyebrow}>{t("sectorsLabel")}</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {sectors.map((s) => {
              const on = selected.includes(s.slug);
              return (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => toggleSector(s.slug)}
                  title={s.description}
                  aria-pressed={on}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "border-primary bg-primary-soft text-chip-ink" : "border-border-input text-ink-soft hover:bg-surface-2"}`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-sm font-semibold text-ink">{t("evidenceTitle")}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{t("evidenceHint")}</p>
          <label className={`${label} mt-3`}>
            <span className={eyebrow}>{t("professionLabel")}</span>
            <input value={profession} onChange={(e) => setProfession(e.target.value)} placeholder={t("professionPlaceholder")} className={input} />
          </label>
          <label className={`${label} mt-3`}>
            <span className={eyebrow}>{t("attestationLabel")}</span>
            <textarea value={attestation} onChange={(e) => setAttestation(e.target.value)} placeholder={t("attestationPlaceholder")} rows={3} className={input} />
          </label>
        </div>

        {error && <p className="text-sm text-accent" role="alert">{error}</p>}

        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-on-primary disabled:opacity-40"
        >
          {submitting ? t("submitting") : t("submit")}
        </button>
        <p className="text-center text-xs text-ink-soft">{t("footnote")}</p>
      </div>
    </div>
  );
}
