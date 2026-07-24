"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Languages } from "lucide-react";

export default function LanguageToggle() {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function change(next: string) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next as (typeof routing.locales)[number] });
    });
  }

  return (
    <div
      role="tablist"
      aria-label={t("label")}
      className={`flex items-center gap-1 rounded-lg border border-border bg-white p-1 ${
        isPending ? "opacity-60" : ""
      }`}
    >
      <Languages size={14} className="ml-1 text-ink-soft" aria-hidden />
      {routing.locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            role="tab"
            aria-selected={active}
            onClick={() => change(l)}
            className={`rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-primary-soft text-primary-pressed" : "text-ink-soft hover:bg-bg"
            }`}
          >
            {t(l)}
          </button>
        );
      })}
    </div>
  );
}
