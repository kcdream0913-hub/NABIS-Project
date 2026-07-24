"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSectors } from "@/lib/useSectors";

// Consent versions captured with each signup (BL-LEGAL-05 v0.2-pilot). These
// ride in user_metadata; handle_new_user() (migration 20260724165101) copies
// country + sectors into the profiles row AND writes an append-only consents
// row per doc — server-side, because there's no client session at signup
// (email confirmation is required). Keep these strings prefixed "tos_"/"privacy_":
// the trigger derives doc_type from the prefix and doc_version from the remainder.
const TOS_VERSION = "tos_v0.2-pilot";
const PRIVACY_VERSION = "privacy_v0.2-pilot";

// Only providers actually configured in Supabase are shown. Verified against the
// prod GoTrue /settings endpoint: google = true, apple = false.
const GOOGLE_ENABLED = true;

function passwordScore(pw: string): 0 | 1 | 2 | 3 {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 3) as 0 | 1 | 2 | 3;
}

const INPUT = "mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary";

export default function SignupPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const supabase = createClient();
  const router = useRouter();
  const sectors = useSectors();
  const searchParams = useSearchParams();
  const inviteId = searchParams.get("invite");

  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState<"" | "us" | "nepal">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function toggleSector(slug: string) {
    setSelected((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) return setError(t("errNameRequired"));
    if (!country) return setError(t("errCountryRequired"));
    if (password.length < 8) return setError(t("errPasswordShort"));
    if (password !== confirm) return setError(t("errPasswordMismatch"));
    if (!agree) return setError(t("errAgree"));

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
        data: {
          name: fullName.trim(),
          full_name: fullName.trim(),
          country, // 'us' | 'nepal' — already lowercase for profiles.country CHECK
          sectors: selected,
          consent: { tos: TOS_VERSION, privacy: PRIVACY_VERSION, at: new Date().toISOString(), locale },
        },
      },
    });
    setLoading(false);
    if (error) return setError(error.message);
    // mailer_autoconfirm is false → email confirmation required; no session yet.
    setDone(true);
  }

  async function handleGoogle() {
    setError(null);
    const next = inviteId ? `/onboarding?invite=${inviteId}` : "/onboarding";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setError(error.message);
  }

  if (done) {
    return (
      <div className="text-center">
        <span className="inline-grid h-10 w-10 place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary">B</span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">{t("checkEmailTitle")}</h1>
        <p className="mt-2 text-sm text-ink-soft">{t("checkEmailBody", { email })}</p>
        <button onClick={() => router.push("/login")}
          className="mt-6 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-pressed">
          {t("goToLogin")}
        </button>
      </div>
    );
  }

  const score = passwordScore(password);
  const scoreLabel = [t("pwWeak"), t("pwWeak"), t("pwFair"), t("pwStrong")][score];
  const scoreColor = ["bg-accent", "bg-accent", "bg-bridge", "bg-active"][score];

  return (
    <div>
      <div className="mb-6 text-center">
        <span className="inline-grid h-10 w-10 place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary">B</span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">{t("joinTitle")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t("joinSubtitle")}</p>
      </div>

      {GOOGLE_ENABLED && (
        <>
          <button onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-bg">
            {t("continueGoogle")}
          </button>
          <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
            <span className="h-px flex-1 bg-border" /> {t("or")} <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={handleSignup} className="space-y-3">
        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">{t("fullName")}</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className={INPUT} />
        </label>

        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">{t("country")}</span>
          <select value={country} onChange={(e) => setCountry(e.target.value as "us" | "nepal")} required className={`${INPUT} bg-surface`}>
            <option value="" disabled>{t("selectCountry")}</option>
            <option value="us">{t("countryUS")}</option>
            <option value="nepal">{t("countryNepal")}</option>
          </select>
        </label>

        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">{t("email")}</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        </label>

        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">{t("password")}</span>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={INPUT} />
          {password && (
            <span className="mt-1.5 flex items-center gap-2">
              <span className="flex h-1 flex-1 gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`h-1 flex-1 rounded-full ${i < score ? scoreColor : "bg-surface-2"}`} />
                ))}
              </span>
              <span className="text-[11px] text-ink-soft">{scoreLabel}</span>
            </span>
          )}
          <span className="mt-1 block text-[11px] text-ink-soft">{t("passwordHint")}</span>
        </label>

        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">{t("confirmPassword")}</span>
          <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={INPUT} />
        </label>

        <fieldset className="block text-sm">
          <legend className="eyebrow text-ink-soft">{t("sectorInterests")}</legend>
          <p className="mt-0.5 text-[11px] text-ink-soft">{t("sectorInterestsHint")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sectors.map((s) => {
              const on = selected.includes(s.slug);
              return (
                <button key={s.slug} type="button" onClick={() => toggleSector(s.slug)} aria-pressed={on}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    on ? "bg-primary-soft text-chip-ink" : "bg-surface-2 text-ink-soft hover:text-ink"
                  }`}>
                  {s.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex items-start gap-2 text-[13px]">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 accent-primary" />
          <span className="text-ink-soft">
            {t("agree18")}{" "}
            <Link href="/terms" className="font-medium text-primary hover:underline">{t("termsLink")}</Link>{" "}
            {t("and")}{" "}
            <Link href="/privacy" className="font-medium text-primary hover:underline">{t("privacyLink")}</Link>. {t("usTransfer")}
          </span>
        </label>

        {error ? <p className="text-sm text-accent" role="alert">{error}</p> : null}

        <button type="submit" disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50">
          {loading ? t("creatingAccount") : t("createAccount")}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {t("alreadyMember")}{" "}
        <Link href="/login" className="font-medium text-primary hover:text-primary-pressed">{t("logIn")}</Link>
      </p>
      <p className="mt-2 text-center text-xs text-ink-soft">{t("browseHint")}</p>
    </div>
  );
}
