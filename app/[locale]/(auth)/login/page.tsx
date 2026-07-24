"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  // Only Google is configured in Supabase (verified via GoTrue /settings —
  // apple = false). A dead OAuth button is worse than none, so Apple is hidden.
  async function handleGoogle() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <span className="inline-grid h-10 w-10 place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary">
          B
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">{t("welcomeBack")}</h1>
      </div>

      <div className="space-y-2">
        <button
          onClick={handleGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-bg"
        >
          {t("continueGoogle")}
        </button>
      </div>

      <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
        <span className="h-px flex-1 bg-border" /> {t("or")} <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleLogin} className="space-y-3">
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
          <span className="flex items-center justify-between">
            <span className="eyebrow text-ink-soft">{t("password")}</span>
            <Link href="/forgot-password" className="text-xs font-medium text-primary hover:text-primary-pressed">
              {t("forgotPassword")}
            </Link>
          </span>
          <input
            type="password"
            required
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
          {loading ? t("loggingIn") : t("logIn")}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {t("newHere")}{" "}
        <Link href="/signup" className="font-medium text-primary hover:text-primary-pressed">
          {t("createAccount")}
        </Link>
      </p>
    </div>
  );
}
