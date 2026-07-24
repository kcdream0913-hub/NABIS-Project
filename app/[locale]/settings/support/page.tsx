import { getTranslations } from "next-intl/server";
import { Mail, LifeBuoy } from "lucide-react";
import { SettingsSection, SettingsNote } from "@/components/settings/primitives";

const SUPPORT_EMAIL = "support@bridgelink.app"; // placeholder — swap for the real inbox

export default async function SupportPage() {
  const t = await getTranslations("settings.support");
  return (
    <SettingsSection title={t("title")} description={t("description")}>
      <div className="flex items-start gap-3">
        <LifeBuoy size={18} strokeWidth={1.9} className="mt-0.5 shrink-0 text-ink-soft" aria-hidden />
        <div>
          <p className="text-sm text-ink">{t("body")}</p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-2 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2">
            <Mail size={15} aria-hidden /> {t("emailUs")}
          </a>
        </div>
      </div>
      <SettingsNote>{t("responseNote")}</SettingsNote>
    </SettingsSection>
  );
}
