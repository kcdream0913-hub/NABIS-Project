"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { QrCode, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SettingsSection, SettingsRow, SettingsNote } from "./primitives";

export default function MobileConnect({ email }: { email: string }) {
  const t = useTranslations("settings.devices");
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [signOutMsg, setSignOutMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function emailCode() {
    setBusy(true); setMsg(null);
    // Email OTP (magic link) — no SMS provider needed; Supabase sends the mail.
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setMsg({ kind: "err", text: error.message });
    else setMsg({ kind: "ok", text: t("codeEmailed") });
    setBusy(false);
  }

  async function signOutOthers() {
    setBusy(true); setSignOutMsg(null); setConfirming(false);
    // Revokes every OTHER session; the current one stays signed in.
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) setSignOutMsg({ kind: "err", text: error.message });
    else setSignOutMsg({ kind: "ok", text: t("signOutDone") });
    setBusy(false);
  }

  return (
    <>
      <SettingsSection title={t("otpTitle")} description={t("otpDescription")}>
        <SettingsRow label={t("otpLabel")} hint={t("otpHint", { email })}>
          <button onClick={emailCode} disabled={busy}
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-pressed disabled:opacity-50">
            {t("emailCode")}
          </button>
        </SettingsRow>
        {msg && <p className={`text-[13px] ${msg.kind === "ok" ? "text-active" : "text-accent"}`} role={msg.kind === "err" ? "alert" : undefined}>{msg.text}</p>}
        <SettingsNote>{t("otpNote")}</SettingsNote>
      </SettingsSection>

      <SettingsSection title={t("signOutTitle")} description={t("signOutDescription")}>
        <SettingsRow label={t("signOutLabel")} hint={t("signOutHint")}>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-ink">{t("signOutConfirm")}</span>
              <button onClick={signOutOthers} disabled={busy}
                className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-on-accent transition hover:opacity-90 disabled:opacity-50">
                {t("signOutConfirmYes")}
              </button>
              <button onClick={() => setConfirming(false)} disabled={busy}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2">
                {t("signOutCancel")}
              </button>
            </div>
          ) : (
            <button onClick={() => { setConfirming(true); setSignOutMsg(null); }} disabled={busy}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2">
              <LogOut size={15} aria-hidden /> {t("signOutOthers")}
            </button>
          )}
        </SettingsRow>
        {signOutMsg && <p className={`text-[13px] ${signOutMsg.kind === "ok" ? "text-active" : "text-accent"}`} role={signOutMsg.kind === "err" ? "alert" : undefined}>{signOutMsg.text}</p>}
      </SettingsSection>

      {/* QR pairing is Beta — the mobile app isn't generally available yet. */}
      <SettingsSection title={t("appTitle")} description={t("appDescription")}>
        <div className="flex items-center gap-4">
          <div className="grid h-28 w-28 shrink-0 place-items-center rounded-lg border border-dashed border-border bg-surface-2 text-ink-soft">
            <QrCode size={40} strokeWidth={1.5} aria-hidden />
          </div>
          <div className="space-y-1.5">
            <span className="inline-block rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              {t("beta")}
            </span>
            <SettingsNote>{t("appScaffold")}</SettingsNote>
          </div>
        </div>
      </SettingsSection>
    </>
  );
}
