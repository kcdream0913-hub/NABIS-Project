"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { mergePreferences, type Preferences, type NotificationFrequency } from "@/lib/preferences";
import { SettingsSection, SettingsRow, SettingsNote } from "./primitives";
import { Toggle, Segmented } from "./controls";

export default function NotificationsForm({ initial }: { initial: Preferences }) {
  const t = useTranslations("settings.notifications");
  const supabase = createClient();
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(p: Partial<Preferences>) { setPrefs((cur) => mergePreferences(cur, p)); setSaved(false); }
  const n = prefs.notifications;

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    // Read-modify-write so we never clobber sibling keys (visibility, timezone).
    const { data: row } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
    const next = mergePreferences(row?.preferences, { notifications: prefs.notifications });
    const { error } = await supabase.from("profiles").update({ preferences: next }).eq("id", user.id);
    if (error) setError(error.message); else setSaved(true);
    setBusy(false);
  }

  const freqOptions: { value: NotificationFrequency; label: string }[] = [
    { value: "immediate", label: t("freq.immediate") },
    { value: "daily", label: t("freq.daily") },
    { value: "off", label: t("freq.off") },
  ];

  return (
    <SettingsSection title={t("title")} description={t("description")}>
      {/* Honest: preferences persist now; email delivery is switched on with the
          email worker (BL-ENGAGE-01). Same honest-scope pattern as privacy's
          enforcementNote — never imply a channel that isn't sending yet. */}
      <SettingsNote>{t("deliveryNote")}</SettingsNote>

      <div className="border-t border-border pt-4">
        <SettingsRow label={t("frequency")} hint={t("frequencyHint")}>
          <Segmented
            value={n.frequency}
            onChange={(v) => patch({ notifications: { ...n, frequency: v } })}
            options={freqOptions}
            ariaLabel={t("frequency")}
          />
        </SettingsRow>
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <SettingsNote>{t("emailHeading")}</SettingsNote>
        <SettingsRow label={t("email.messages")} hint={t("email.messagesHint")}>
          <Toggle checked={n.email.messages}
            onChange={(v) => patch({ notifications: { ...n, email: { ...n.email, messages: v } } })} label={t("email.messages")} />
        </SettingsRow>
        <SettingsRow label={t("email.events")} hint={t("email.eventsHint")}>
          <Toggle checked={n.email.events}
            onChange={(v) => patch({ notifications: { ...n, email: { ...n.email, events: v } } })} label={t("email.events")} />
        </SettingsRow>
        <SettingsRow label={t("email.connections")} hint={t("email.connectionsHint")}>
          <Toggle checked={n.email.connections}
            onChange={(v) => patch({ notifications: { ...n, email: { ...n.email, connections: v } } })} label={t("email.connections")} />
        </SettingsRow>
        <SettingsRow label={t("email.verification")} hint={t("email.verificationHint")}>
          <Toggle checked={n.email.verification}
            onChange={(v) => patch({ notifications: { ...n, email: { ...n.email, verification: v } } })} label={t("email.verification")} />
        </SettingsRow>
      </div>

      <div className="border-t border-border pt-4">
        <SettingsRow label={t("loginAlerts")} hint={t("loginAlertsHint")}>
          <Toggle checked={n.login_alerts}
            onChange={(v) => patch({ notifications: { ...n, login_alerts: v } })} label={t("loginAlerts")} />
        </SettingsRow>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <button onClick={save} disabled={busy}
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-pressed disabled:opacity-50">
          {t("save")}
        </button>
        {saved && <span className="text-[13px] text-active">{t("saved")}</span>}
        {error && <span className="min-w-0 break-words text-[13px] text-accent" role="alert">{error}</span>}
      </div>
    </SettingsSection>
  );
}
