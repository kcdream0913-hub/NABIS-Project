import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import SettingsNav from "@/components/settings/SettingsNav";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("settings");
  return (
    <div className="mx-auto max-w-4xl">
      <p className="eyebrow text-ink-soft">{t("eyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-ink">{t("title")}</h1>
      <div className="mt-4 grid gap-6 md:grid-cols-[190px_1fr]">
        <SettingsNav />
        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </div>
  );
}
