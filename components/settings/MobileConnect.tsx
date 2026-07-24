"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SettingsSection, SettingsRow, SettingsNote } from "./primitives";

const INPUT =
  "w-full rounded-md border border-border-input bg-surface px-3 py-2 text-sm text-ink focus:border-primary sm:w-64";
const BTN =
  "rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-pressed disabled:opacity-50";

export default function MobileConnect({ currentPhone }: { currentPhone: string | null }) {
  const t = useTranslations("settings.devices");
  const supabase = createClient();
  const [phone, setPhone] = useState(currentPhone ?? "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function sendCode() {
    setBusy(true); setMsg(null);
    // Real Supabase phone OTP. Requires an SMS provider configured on the project;
    // if none is set the send errors, and we surface that honestly.
    const { error } = await supabase.auth.updateUser({ phone });
    if (error) setMsg({ kind: "err", text: error.message });
    else { setSent(true); setMsg({ kind: "ok", text: t("codeSent") }); }
    setBusy(false);
  }

  async function verify() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "phone_change" });
    if (error) setMsg({ kind: "err", text: error.message });
    else { setSent(false); setCode(""); setMsg({ kind: "ok", text: t("verified") }); }
    setBusy(false);
  }

  return (
    <>
      <SettingsSection title={t("phoneTitle")} description={t("phoneDescription")}>
        <SettingsRow label={t("phoneLabel")} hint={t("phoneHint")} htmlFor="mc-phone">
          <div className="space-y-1.5">
            <input id="mc-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 000 1234" className={INPUT} />
            <button onClick={sendCode} disabled={busy || !phone} className={BTN}>{t("sendCode")}</button>
          </div>
        </SettingsRow>

        {sent && (
          <div className="border-t border-border pt-4">
            <SettingsRow label={t("codeLabel")} hint={t("codeHint")} htmlFor="mc-code">
              <div className="space-y-1.5">
                <input id="mc-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)}
                  placeholder="123456" className={INPUT} />
                <button onClick={verify} disabled={busy || !code} className={BTN}>{t("verify")}</button>
              </div>
            </SettingsRow>
          </div>
        )}

        {msg && <p className={`text-[13px] ${msg.kind === "ok" ? "text-active" : "text-accent"}`} role={msg.kind === "err" ? "alert" : undefined}>{msg.text}</p>}
        <SettingsNote>{t("smsProviderNote")}</SettingsNote>
      </SettingsSection>

      {/* QR pairing is a scaffold — the mobile app doesn't exist yet. Labeled as such. */}
      <SettingsSection title={t("appTitle")} description={t("appDescription")}>
        <div className="flex items-center gap-4">
          <div className="grid h-28 w-28 shrink-0 place-items-center rounded-lg border border-dashed border-border bg-surface-2 text-ink-soft">
            <QrCode size={40} strokeWidth={1.5} aria-hidden />
          </div>
          <SettingsNote>{t("appScaffold")}</SettingsNote>
        </div>
      </SettingsSection>
    </>
  );
}
