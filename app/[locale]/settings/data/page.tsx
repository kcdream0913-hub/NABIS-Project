import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SettingsSection, SettingsNote } from "@/components/settings/primitives";
import DownloadDataButton from "@/components/settings/DownloadDataButton";

export default async function DataPage() {
  const t = await getTranslations("settings.data");
  return (
    <>
      <SettingsSection title={t("title")} description={t("description")}>
        <DownloadDataButton />
        <SettingsNote>{t("downloadNote")}</SettingsNote>
      </SettingsSection>

      <SettingsSection title={t("legalTitle")} description={t("legalDescription")}>
        <div className="flex flex-col gap-2">
          <Link href="/terms" className="text-sm font-medium text-primary hover:underline">{t("terms")}</Link>
          <Link href="/privacy" className="text-sm font-medium text-primary hover:underline">{t("privacyPolicy")}</Link>
        </div>
      </SettingsSection>
    </>
  );
}
