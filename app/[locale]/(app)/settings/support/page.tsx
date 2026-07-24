import { getTranslations } from "next-intl/server";
import { Mail, LifeBuoy } from "lucide-react";
import { SettingsSection, SettingsNote } from "@/components/settings/primitives";

// Pilot support routes to the founder's inbox. NOT support@bridgelink.app — that
// domain isn't owned, so publishing it would send users' support mail to whoever
// registers it.
const SUPPORT_EMAIL = "kcdream0913@gmail.com";
const SUPPORT_SUBJECT = "BridgeLink support request";

export default async function SupportPage() {
  const t = await getTranslations("settings.support");
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}`;
  return (
    <SettingsSection title={t("title")} description={t("description")}>
      <div className="flex items-start gap-3">
        <LifeBuoy size={18} strokeWidth={1.9} className="mt-0.5 shrink-0 text-ink-soft" aria-hidden />
        <div>
          <p className="text-sm text-ink">{t("body")}</p>
          <p className="mt-2 text-sm">
            <span className="font-medium text-ink">{t("pilotSupportLabel")}:</span>{" "}
            <a href={mailto} className="text-primary hover:underline">{SUPPORT_EMAIL}</a>
          </p>
          <a href={mailto} className="mt-2 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-surface-2">
            <Mail size={15} aria-hidden /> {t("emailUs")}
          </a>
        </div>
      </div>
      <SettingsNote>{t("responseNote")}</SettingsNote>
    </SettingsSection>
  );
}
