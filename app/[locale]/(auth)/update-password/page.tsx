"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/PasswordInput";

// Landing page for the password-recovery flow. /auth/callback routes a
// type=recovery code exchange here instead of home — see that route's
// comment. Relies on the session the callback just established via
// exchangeCodeForSession; supabase.auth.updateUser() works against any active
// session, recovery or ordinary, so a normally-logged-in user who navigates
// here directly can also change their password without re-entering the
// current one (unlike settings/account's flow, which re-verifies via
// signInWithPassword first). That's an accepted trade-off of Supabase's
// recovery model, not unique to this page — flagged, not engineered around.
export default function UpdatePasswordPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t("errPasswordShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("errPasswordMismatch"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <span className="inline-grid h-10 w-10 place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary">
          B
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">{t("updatePasswordTitle")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t("updatePasswordSubtitle")}</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">{t("newPassword")}</span>
          <PasswordInput
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
          />
          <span className="mt-1 block text-xs text-ink-soft">{t("passwordHint")}</span>
        </label>
        <label className="block text-sm">
          <span className="eyebrow text-ink-soft">{t("confirmPassword")}</span>
          <PasswordInput
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary"
          />
        </label>
        {error ? (
          <p className="text-sm text-accent" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50"
        >
          {loading ? t("updatingPassword") : t("updatePasswordCta")}
        </button>
      </form>
    </div>
  );
}
