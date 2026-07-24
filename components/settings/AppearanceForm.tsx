"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/client";
import { useTheme, type ThemeMode, type FontScale } from "@/components/ThemeProvider";
import { mergePreferences } from "@/lib/preferences";
import { TIMEZONE_GROUPS, defaultTimezone, zoneLabel } from "@/lib/timezones";
import { SettingsSection, SettingsRow, SettingsNote } from "./primitives";
import { Segmented } from "./controls";

export default function AppearanceForm({ initialTimezone }: { initialTimezone: string }) {
  const t = useTranslations("settings.appearance");
  const tLang = useTranslations("language");
  const { theme, setTheme, fontScale, setFontScale } = useTheme();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const [tz, setTz] = useState(initialTimezone);
  const [tzBusy, setTzBusy] = useState(false);
  const [tzSaved, setTzSaved] = useState(false);
  const detected = defaultTimezone();

  function changeLocale(next: string) {
    if (next === locale) return;
    startTransition(() => router.replace(pathname, { locale: next as (typeof routing.locales)[number] }));
  }

  async function saveTz() {
    setTzBusy(true); setTzSaved(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setTzBusy(false); return; }
    const { data: row } = await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle();
    const next = mergePreferences(row?.preferences, { timezone: tz });
    const { error } = await supabase.from("profiles").update({ preferences: next }).eq("id", user.id);
    if (!error) setTzSaved(true);
    setTzBusy(false);
  }

  const themeOpts: { value: ThemeMode; label: string }[] = [
    { value: "light", label: t("theme.light") },
    { value: "dark", label: t("theme.dark") },
    { value: "system", label: t("theme.system") },
  ];
  const fontOpts: { value: FontScale; label: string }[] = [
    { value: "small", label: t("font.small") },
    { value: "normal", label: t("font.normal") },
    { value: "large", label: t("font.large") },
  ];

  return (
    <>
      <SettingsSection title={t("title")} description={t("description")}>
        <SettingsRow label={t("theme.label")} hint={t("theme.hint")}>
          <Segmented value={theme} onChange={setTheme} options={themeOpts} ariaLabel={t("theme.label")} />
        </SettingsRow>
        <div className="border-t border-border pt-4">
          <SettingsRow label={t("font.label")} hint={t("font.hint")}>
            <Segmented value={fontScale} onChange={setFontScale} options={fontOpts} ariaLabel={t("font.label")} />
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection title={t("regionTitle")} description={t("regionDescription")}>
        <SettingsRow label={t("language")} hint={t("languageHint")}>
          <div className={`inline-flex rounded-lg border border-border bg-surface-2 p-0.5 ${isPending ? "opacity-60" : ""}`}>
            {routing.locales.map((l) => (
              <button key={l} type="button" onClick={() => changeLocale(l)} aria-pressed={l === locale}
                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                  l === locale ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
                }`}>
                {tLang(l)}
              </button>
            ))}
          </div>
        </SettingsRow>

        <div className="space-y-2 border-t border-border pt-4">
          <SettingsRow label={t("timezone")} hint={t("timezoneHint")} htmlFor="tz-select">
            <select id="tz-select" value={tz} onChange={(e) => { setTz(e.target.value); setTzSaved(false); }}
              className="w-full rounded-md border border-border-input bg-surface px-3 py-2 text-sm text-ink focus:border-primary sm:w-64">
              {TIMEZONE_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.zones.map((z) => <option key={z} value={z}>{zoneLabel(z)}</option>)}
                </optgroup>
              ))}
            </select>
          </SettingsRow>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={saveTz} disabled={tzBusy}
              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-pressed disabled:opacity-50">
              {t("save")}
            </button>
            {detected && detected !== tz && (
              <button onClick={() => { setTz(detected); setTzSaved(false); }}
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2">
                {t("useDetected", { tz: zoneLabel(detected) })}
              </button>
            )}
            {tzSaved && <span className="text-[13px] text-active">{t("saved")}</span>}
          </div>
          <SettingsNote>{t("timezoneUsage")}</SettingsNote>
        </div>
      </SettingsSection>
    </>
  );
}
