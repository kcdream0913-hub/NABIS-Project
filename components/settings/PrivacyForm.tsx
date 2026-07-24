"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { mergePreferences, type Preferences, type Visibility } from "@/lib/preferences";
import { SettingsSection, SettingsRow, SettingsNote } from "./primitives";
import { Toggle, Segmented } from "./controls";

export default function PrivacyForm({ initial }: { initial: Preferences }) {
  const t = useTranslations("settings.privacy");
  const supabase = createClient();
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(p: Partial<Preferences>) { setPrefs((cur) => mergePreferences(cur, p)); setSaved(false); }

  async function save() {
    setBusy(true); setError(null); setSaved(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    // Read-modify-write so we never clobber sibling keys (timezone, notifications).
    const { data: row } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
    const next = mergePreferences(row?.preferences, {
      visibility: prefs.visibility,
      data_usage_opt_in: prefs.data_usage_opt_in,
      sharing_defaults: prefs.sharing_defaults,
    });
    const { error } = await supabase.from("profiles").update({ preferences: next }).eq("id", user.id);
    if (error) setError(error.message); else setSaved(true);
    setBusy(false);
  }

  const visOptions: { value: Visibility; label: string }[] = [
    { value: "public", label: t("visibility.public") },
    { value: "bridge", label: t("visibility.bridge") },
    { value: "private", label: t("visibility.private") },
  ];

  return (
    <SettingsSection title={t("title")} description={t("description")}>
      <SettingsRow label={t("profileVisibility")} hint={t("visibilityHint")}>
        <Segmented value={prefs.visibility} onChange={(v) => patch({ visibility: v })} options={visOptions} ariaLabel={t("profileVisibility")} />
      </SettingsRow>
      {/* Honest: storing the preference now; feeds/directory/DM enforcement is the next commit. */}
      <SettingsNote>{t("enforcementNote")}</SettingsNote>

      <div className="space-y-4 border-t border-border pt-4">
        <SettingsRow label={t("showEmail")} hint={t("showEmailHint")}>
          <Toggle checked={prefs.sharing_defaults.show_email}
            onChange={(v) => patch({ sharing_defaults: { ...prefs.sharing_defaults, show_email: v } })} label={t("showEmail")} />
        </SettingsRow>
        <SettingsRow label={t("showPhone")} hint={t("showPhoneHint")}>
          <Toggle checked={prefs.sharing_defaults.show_phone}
            onChange={(v) => patch({ sharing_defaults: { ...prefs.sharing_defaults, show_phone: v } })} label={t("showPhone")} />
        </SettingsRow>
      </div>

      <div className="border-t border-border pt-4">
        <SettingsRow label={t("dataUsage")} hint={t("dataUsageHint")}>
          <Toggle checked={prefs.data_usage_opt_in} onChange={(v) => patch({ data_usage_opt_in: v })} label={t("dataUsage")} />
        </SettingsRow>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-4">
        <button onClick={save} disabled={busy}
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-pressed disabled:opacity-50">
          {t("save")}
        </button>
        {saved && <span className="text-[13px] text-active">{t("saved")}</span>}
        {error && <span className="text-[13px] text-accent" role="alert">{error}</span>}
      </div>
    </SettingsSection>
  );
}
