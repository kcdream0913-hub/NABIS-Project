"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // D-071: Supabase's /auth/v1/verify redirect (the PKCE code-exchange flow
    // resetPasswordForEmail uses) only appends `code` to redirect_to on
    // success — it does NOT forward a `type=recovery` marker the way the
    // token_hash-based /auth/confirm pattern in Supabase's own docs does.
    // /auth/callback's D-069 fix depends on reading `type` from its query
    // string to route recovery to /update-password instead of `next`; without
    // this, `type` is always null there and every recovery link fell through
    // to `next` ("/") again — confirmed live 2026-07-30 (Vercel logs: /auth/
    // callback 307 -> GET / 200, no /update-password hit). Baking type=recovery
    // into redirectTo itself works because GoTrue preserves existing query
    // params on redirect_to and just adds `code` alongside them.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?type=recovery`,
    });
    setLoading(false);
    if (error) {
      // over_email_send_rate_limit is Supabase's built-in-mailer project-wide
      // cap (see D-071 CLAUDE.md note) — surfacing the raw "email rate limit
      // exceeded" string reads as a broken app, not a "try again shortly"
      // condition. Every other error.message still passes through unchanged.
      setError(error.code === "over_email_send_rate_limit" ? t("errResetRateLimited") : error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <span className="inline-grid h-10 w-10 place-items-center rounded-lg bg-primary text-sm font-bold text-on-primary">B</span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink">{t("resetTitle")}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t("resetSubtitle")}</p>
      </div>

      {sent ? (
        <p className="rounded-md bg-active-soft p-3 text-sm text-active" role="status">{t("resetSent")}</p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            <span className="eyebrow text-ink-soft">{t("email")}</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border-input px-3 py-2 text-sm focus:border-primary" />
          </label>
          {error ? <p className="text-sm text-accent" role="alert">{error}</p> : null}
          <button type="submit" disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:bg-primary-pressed disabled:opacity-50">
            {loading ? t("sending") : t("sendReset")}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-ink-soft">
        <Link href="/login" className="font-medium text-primary hover:text-primary-pressed">{t("backToLogin")}</Link>
      </p>
    </div>
  );
}
