"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const inviteId = searchParams.get("invite");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Carry the invite through to onboarding — redemption happens there,
    // where an authenticated session is guaranteed (signup itself may still
    // be pending email confirmation depending on project auth settings).
    router.push(inviteId ? `/onboarding?invite=${inviteId}` : "/onboarding");
  }

  async function handleOAuth(providerName: "google" | "apple") {
    setError(null);
    const next = inviteId ? `/onboarding?invite=${inviteId}` : "/onboarding";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: providerName,
      options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <div className="mb-8 text-center">
        <span className="inline-grid h-10 w-10 place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary">
          B
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">{t("joinTitle")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t("joinSubtitle")}</p>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => handleOAuth("google")}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-bg"
        >
          {t("continueGoogle")}
        </button>
        <button
          onClick={() => handleOAuth("apple")}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-bg"
        >
          {t("continueApple")}
        </button>
      </div>

      <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
        <span className="h-px flex-1 bg-border" /> {t("or")} <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSignup} className="space-y-3">
        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">{t("emailOrPhone")}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
          />
        </label>
        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">{t("password")}</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
          />
        </label>
        {error ? <p className="text-sm text-accent">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50"
        >
          {loading ? t("creatingAccount") : t("createAccount")}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {t("alreadyMember")}{" "}
        <Link href="/login" className="font-medium text-primary hover:text-primary-pressed">
          {t("logIn")}
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-ink-soft">{t("browseHint")}</p>
    </div>
  );
}
