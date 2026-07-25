"use client";

import { useTranslations } from "next-intl";

// Step 0 — the fork (BL-BIZ-02 §4). One question, two equal-weight buttons, no
// default highlight. Writes country_of_registration (via the chosen path) and
// routes: US → existing manual form (D-033), Nepal → guided builder. The Google
// import affordance stays hidden (D-028 off).
export default function Step0Country({ onPick }: { onPick: (path: "us" | "nepal") => void }) {
  const t = useTranslations("guided");
  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow text-ink-soft">{t("forkEyebrow")}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("forkQuestion")}</h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onPick("us")}
          className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-xl border border-border-input bg-surface p-5 text-center hover:border-primary hover:bg-surface-2"
        >
          <span className="text-3xl" aria-hidden>🇺🇸</span>
          <span className="text-base font-semibold text-ink">{t("forkUS")}</span>
        </button>
        <button
          type="button"
          onClick={() => onPick("nepal")}
          className="flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-xl border border-border-input bg-surface p-5 text-center hover:border-primary hover:bg-surface-2"
        >
          <span className="text-3xl" aria-hidden>🇳🇵</span>
          <span className="text-base font-semibold text-ink">{t("forkNepal")}</span>
        </button>
      </div>

      <p className="mt-4 text-xs text-ink-soft">{t("forkElsewhere")}</p>
    </div>
  );
}
