"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

// Lead capture — ports the static form's UX onto the app's Supabase client,
// inserting into public.access_requests ({ email, source: 'homepage' }); the
// production anon INSERT-only RLS policy already exists. Disable on submit; a
// unique-violation (23505 / already requested) counts as success; the success
// block shows; real errors re-enable the button. No new RLS policy.
export default function RequestInviteForm() {
  const t = useTranslations("marketing");
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("access_requests").insert({ email: value, source: "homepage" });
    // Duplicate email = already on the list = success, not an error.
    if (err && err.code !== "23505" && !/duplicate/i.test(err.message)) {
      setError(t("requestError"));
      setBusy(false);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "14px 16px", borderRadius: 12, background: "var(--glacier-wash-10)" }}>
        <span style={{ font: "400 12px/1.6 'Geist Mono',monospace", color: "var(--glacier)" }}>✓</span>
        <span style={{ font: "400 15px/1.6 'Geist',sans-serif", color: "var(--ink)" }}>{t("requestSent")}</span>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={submit} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "stretch" }}>
        <input
          id="bl-email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          data-focus="borderColor:var(--glacier);background:var(--surface)"
          style={{ flex: "1 1 240px", minWidth: 0, boxSizing: "border-box", font: "400 16px/1.4 'Geist',sans-serif", color: "var(--ink)", background: "var(--field)", border: "1px solid var(--line-14)", borderRadius: 12, padding: "16px 18px", outline: "none", transition: "border-color 180ms,background 180ms" }}
        />
        <button
          type="submit"
          disabled={busy}
          data-magnetic=""
          data-hover="background:var(--btn-hover)"
          style={{ flex: "0 0 auto", font: "500 15px/1 'Geist',sans-serif", color: "#FBF8F1", background: "var(--btn)", border: "none", borderRadius: 12, padding: "17px 26px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, transition: "background 180ms" }}
        >
          {busy ? t("requesting") : t("requestCta")}
        </button>
      </form>
      {error && <p style={{ margin: 0, font: "400 13px/1.6 'Geist',sans-serif", color: "#B4262A" }} role="alert">{error}</p>}
    </>
  );
}
