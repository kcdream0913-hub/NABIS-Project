"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { SettingsSection, SettingsRow } from "./primitives";

type Status = { kind: "idle" | "ok" | "err"; msg?: string };

const INPUT =
  "w-full rounded-md border border-border-input bg-surface px-3 py-2 text-sm text-ink focus:border-primary sm:w-64";
const BTN =
  "rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-pressed disabled:opacity-50";

export default function AccountForm({ initialName, email }: { initialName: string; email: string }) {
  const t = useTranslations("settings.account");
  const supabase = createClient();

  const [name, setName] = useState(initialName);
  const [nameStatus, setNameStatus] = useState<Status>({ kind: "idle" });
  const [newEmail, setNewEmail] = useState(email);
  const [emailStatus, setEmailStatus] = useState<Status>({ kind: "idle" });
  const [password, setPassword] = useState("");
  const [pwStatus, setPwStatus] = useState<Status>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  async function saveName() {
    setBusy(true); setNameStatus({ kind: "idle" });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { error } = await supabase.from("profiles").update({ name }).eq("id", user.id);
    setNameStatus(error ? { kind: "err", msg: error.message } : { kind: "ok", msg: t("saved") });
    setBusy(false);
  }

  async function saveEmail() {
    setBusy(true); setEmailStatus({ kind: "idle" });
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailStatus(error ? { kind: "err", msg: error.message } : { kind: "ok", msg: t("emailConfirmSent") });
    setBusy(false);
  }

  async function savePassword() {
    if (password.length < 8) { setPwStatus({ kind: "err", msg: t("pwTooShort") }); return; }
    setBusy(true); setPwStatus({ kind: "idle" });
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setPwStatus({ kind: "err", msg: error.message });
    else { setPwStatus({ kind: "ok", msg: t("saved") }); setPassword(""); }
    setBusy(false);
  }

  const note = (s: Status) =>
    s.kind === "idle" ? null : (
      <p className={`text-[13px] ${s.kind === "ok" ? "text-active" : "text-accent"}`} role={s.kind === "err" ? "alert" : undefined}>
        {s.msg}
      </p>
    );

  return (
    <SettingsSection title={t("title")} description={t("description")}>
      <SettingsRow label={t("nameLabel")} htmlFor="acct-name">
        <div className="space-y-1.5">
          <input id="acct-name" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
          <div className="flex items-center gap-2">
            <button onClick={saveName} disabled={busy || name === initialName} className={BTN}>{t("save")}</button>
            {note(nameStatus)}
          </div>
        </div>
      </SettingsRow>

      <div className="border-t border-border pt-4">
        <SettingsRow label={t("emailLabel")} hint={t("emailHint")} htmlFor="acct-email">
          <div className="space-y-1.5">
            <input id="acct-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={INPUT} />
            <div className="flex items-center gap-2">
              <button onClick={saveEmail} disabled={busy || newEmail === email} className={BTN}>{t("updateEmail")}</button>
              {note(emailStatus)}
            </div>
          </div>
        </SettingsRow>
      </div>

      <div className="border-t border-border pt-4">
        <SettingsRow label={t("passwordLabel")} hint={t("passwordHint")} htmlFor="acct-pw">
          <div className="space-y-1.5">
            <input id="acct-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")} className={INPUT} />
            <div className="flex items-center gap-2">
              <button onClick={savePassword} disabled={busy || !password} className={BTN}>{t("updatePassword")}</button>
              {note(pwStatus)}
            </div>
          </div>
        </SettingsRow>
      </div>
    </SettingsSection>
  );
}
