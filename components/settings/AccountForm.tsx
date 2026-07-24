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

// Optional; permissive on purpose (international formats vary widely).
const PHONE_OK = /^[+]?[\d][\d\s\-()]{6,}$/;

export default function AccountForm({
  initialName,
  email,
  initialPhone,
}: {
  initialName: string;
  email: string;
  initialPhone: string;
}) {
  const t = useTranslations("settings.account");
  const supabase = createClient();

  const [name, setName] = useState(initialName);
  const [nameStatus, setNameStatus] = useState<Status>({ kind: "idle" });
  const [newEmail, setNewEmail] = useState(email);
  const [emailStatus, setEmailStatus] = useState<Status>({ kind: "idle" });
  const [phone, setPhone] = useState(initialPhone);
  const [phoneStatus, setPhoneStatus] = useState<Status>({ kind: "idle" });

  // Real password change: verify the current password, then update.
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwStatus, setPwStatus] = useState<Status>({ kind: "idle" });

  const [busy, setBusy] = useState(false);

  async function saveName() {
    if (name.trim() === email) {
      setNameStatus({ kind: "err", msg: t("errNameIsEmail") });
      return;
    }
    setBusy(true); setNameStatus({ kind: "idle" });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { error } = await supabase.from("profiles").update({ name: name.trim() }).eq("id", user.id);
    setNameStatus(error ? { kind: "err", msg: error.message } : { kind: "ok", msg: t("saved") });
    setBusy(false);
  }

  async function saveEmail() {
    setBusy(true); setEmailStatus({ kind: "idle" });
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setEmailStatus(error ? { kind: "err", msg: error.message } : { kind: "ok", msg: t("emailConfirmSent") });
    setBusy(false);
  }

  async function savePhone() {
    const trimmed = phone.trim();
    if (trimmed && !PHONE_OK.test(trimmed)) {
      setPhoneStatus({ kind: "err", msg: t("errPhoneInvalid") });
      return;
    }
    setBusy(true); setPhoneStatus({ kind: "idle" });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { error } = await supabase.from("profiles").update({ phone: trimmed || null }).eq("id", user.id);
    setPhoneStatus(error ? { kind: "err", msg: error.message } : { kind: "ok", msg: t("saved") });
    setBusy(false);
  }

  async function savePassword() {
    setPwStatus({ kind: "idle" });
    if (next.length < 8) { setPwStatus({ kind: "err", msg: t("pwTooShort") }); return; }
    if (next === current) { setPwStatus({ kind: "err", msg: t("pwSameAsCurrent") }); return; }
    if (confirm !== next) { setPwStatus({ kind: "err", msg: t("pwMismatch") }); return; }

    setBusy(true);
    // Re-authenticate with the current password before allowing the change. This
    // returns a fresh session for the same user (does not sign them out).
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: current });
    if (verifyErr) {
      setPwStatus({ kind: "err", msg: t("pwWrongCurrent") });
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) setPwStatus({ kind: "err", msg: error.message });
    else {
      setPwStatus({ kind: "ok", msg: t("saved") });
      setCurrent(""); setNext(""); setConfirm("");
    }
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
      {/* Display name */}
      <SettingsRow label={t("nameLabel")} hint={t("nameHelper")} htmlFor="acct-name">
        <div className="space-y-1.5">
          <input id="acct-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} className={INPUT} />
          <div className="flex items-center gap-2">
            <button onClick={saveName} disabled={busy || !name.trim() || name === initialName} className={BTN}>{t("save")}</button>
            {note(nameStatus)}
          </div>
        </div>
      </SettingsRow>

      {/* Email */}
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

      {/* Phone */}
      <div className="border-t border-border pt-4">
        <SettingsRow label={t("phoneLabel")} hint={t("phoneHint")} htmlFor="acct-phone">
          <div className="space-y-1.5">
            <input id="acct-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("phonePlaceholder")} className={INPUT} />
            <div className="flex items-center gap-2">
              <button onClick={savePhone} disabled={busy || phone === initialPhone} className={BTN}>{t("updatePhone")}</button>
              {note(phoneStatus)}
            </div>
          </div>
        </SettingsRow>
      </div>

      {/* Password */}
      <div className="border-t border-border pt-4">
        <SettingsRow label={t("passwordLabel")} hint={t("passwordHint")}>
          <div className="space-y-2">
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder={t("currentPasswordPlaceholder")} className={INPUT} aria-label={t("currentPassword")} />
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder={t("newPasswordPlaceholder")} className={INPUT} aria-label={t("newPassword")} />
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t("confirmPasswordPlaceholder")} className={INPUT} aria-label={t("confirmPassword")} />
            <div className="flex items-center gap-2">
              <button onClick={savePassword} disabled={busy || !current || !next || !confirm} className={BTN}>{t("updatePassword")}</button>
              {note(pwStatus)}
            </div>
          </div>
        </SettingsRow>
      </div>
    </SettingsSection>
  );
}
