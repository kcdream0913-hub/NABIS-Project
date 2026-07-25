"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "@/components/ThemeProvider";

// The marketing sun/moon toggle, wired to the app's ThemeProvider (one theme
// convention everywhere). Flips between explicit light/dark; the app's head
// script already resolved 'system' before paint, so the icon reflects the real
// state via resolvedDark. Keeps the brief cross-fade the static site had.
export default function ThemeToggle() {
  const { resolvedDark, setTheme } = useTheme();
  const t = useTranslations("marketing");

  function toggle() {
    const root = document.documentElement;
    root.classList.add("theme-anim");
    window.setTimeout(() => root.classList.remove("theme-anim"), 320);
    setTheme(resolvedDark ? "light" : "dark");
  }

  return (
    <button
      className="bl-toggle"
      type="button"
      onClick={toggle}
      aria-label={resolvedDark ? t("toggleToLight") : t("toggleToDark")}
    >
      {resolvedDark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.2 14.2A8.3 8.3 0 0 1 9.8 3.8a8.3 8.3 0 1 0 10.4 10.4Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7" />
        </svg>
      )}
    </button>
  );
}
