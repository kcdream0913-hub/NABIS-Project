"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// Short display codes — the native names ("English" / "नेपाली") are too wide for
// the mobile topbar. aria-label/title still carry the full name for a11y.
const SHORT: Record<string, string> = { en: "EN", ne: "ने" };

/**
 * Compact language switch (EN | ने) for the app topbar, so the locale is
 * switchable on mobile without digging into Settings. Same mechanism as the auth
 * + marketing switchers and Settings → Language: router.replace to the
 * /ne-prefixed path, which next-intl's middleware pairs with the NEXT_LOCALE
 * cookie so the choice persists across navigations. Visible at every width.
 */
export default function LocaleSwitch() {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={`flex items-center rounded-md border border-border bg-surface p-0.5 ${isPending ? "opacity-60" : ""}`}
    >
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => l !== locale && startTransition(() => router.replace(pathname, { locale: l }))}
          aria-pressed={l === locale}
          aria-label={t(l)}
          title={t(l)}
          className={`rounded-[5px] px-1.5 py-1 text-xs font-semibold transition-colors ${
            l === locale ? "bg-surface-2 text-ink" : "text-ink-soft hover:text-ink"
          }`}
        >
          {SHORT[l] ?? l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
