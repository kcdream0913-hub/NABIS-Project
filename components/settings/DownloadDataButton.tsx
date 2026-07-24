"use client";

import { useLocale, useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { routing } from "@/i18n/routing";

export default function DownloadDataButton() {
  const t = useTranslations("settings.data");
  const locale = useLocale();
  // as-needed locale prefix: default locale is unprefixed, others carry /<locale>.
  const href =
    locale === routing.defaultLocale
      ? "/settings/data/export"
      : `/${locale}/settings/data/export`;

  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-primary-pressed"
    >
      <Download size={16} strokeWidth={2} aria-hidden />
      {t("downloadButton")}
    </a>
  );
}
