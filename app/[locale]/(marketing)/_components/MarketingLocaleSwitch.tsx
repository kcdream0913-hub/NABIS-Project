"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// The marketing EN / ने switch — the app's path-based locale switcher (same as the
// auth pages), replacing the static site's own /ne link-rewriting. Sets the locale
// (adds /ne, writes NEXT_LOCALE) via next-intl navigation.
export default function MarketingLocaleSwitch() {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 8, opacity: isPending ? 0.6 : 1 }}>
      {routing.locales.map((l, i) => (
        <span key={l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {i > 0 && <span aria-hidden style={{ color: "var(--ink-faint)" }}>·</span>}
          <button
            type="button"
            onClick={() => l !== locale && startTransition(() => router.replace(pathname, { locale: l }))}
            aria-pressed={l === locale}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              font: "400 14px/1 'Geist',sans-serif",
              color: l === locale ? "var(--ink)" : "var(--ink-mid)",
            }}
          >
            {t(l)}
          </button>
        </span>
      ))}
    </span>
  );
}
