"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * Pre-login language switch (English | नेपाली) for the auth card footer. Settings
 * is unreachable before sign-in, so a Nepali-only user needs a way to switch
 * here. The top-bar toggle was removed; language now lives in Settings + here.
 */
export default function AuthLocaleSwitch() {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className={`flex items-center gap-2 text-sm ${isPending ? "opacity-60" : ""}`}>
      {routing.locales.map((l, i) => (
        <span key={l} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden className="text-ink-soft">·</span>}
          <button
            type="button"
            onClick={() => l !== locale && startTransition(() => router.replace(pathname, { locale: l }))}
            aria-pressed={l === locale}
            className={l === locale ? "font-semibold text-ink" : "text-ink-soft hover:text-ink"}
          >
            {t(l)}
          </button>
        </span>
      ))}
    </div>
  );
}
