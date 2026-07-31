"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { adToBS, formatBSDate, toNepaliDigits } from "@/lib/bikramSambat";
import { upcomingFestivals } from "@/lib/almanac";
import type { Festival } from "@/lib/offerings";

/**
 * Nepali-calendar habit anchor (BL-ENGAGE-01 #2). `full` = a rail card with the
 * Bikram Sambat date + upcoming-festival countdowns (Feed rail, xl+). `chip` = a
 * compact BS-date pill so the anchor isn't desktop-only (shown below xl). The
 * chip skips the festivals query — it's the date only.
 */
export default function NepaliAlmanac({ variant = "full" }: { variant?: "full" | "chip" }) {
  const t = useTranslations("almanac");
  const locale = useLocale();
  const supabase = createClient();
  // One "now" per mount — a stable reference day for both the BS date and the
  // festival countdowns (so they can't disagree across a re-render at midnight).
  const [today] = useState(() => new Date());
  const [festivals, setFestivals] = useState<Festival[]>([]);

  useEffect(() => {
    if (variant === "chip") return; // chip is the date only — no festival data
    let active = true;
    (async () => {
      // RLS: festivals is SELECT-only for authenticated users (reference data).
      const { data } = await supabase
        .from("festivals")
        .select("slug, name, name_ne, country, month_hint, dates");
      if (active) setFestivals((data as Festival[] | null) ?? []);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant]);

  const bs = adToBS(today);
  if (!bs) return null; // outside the converter's range — hide, never crash
  const bsLabel = formatBSDate(bs, locale);

  if (variant === "chip") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
        <CalendarDays size={16} strokeWidth={1.9} className="shrink-0 text-primary" />
        <span className="font-medium text-ink">{t("today")}</span>
        <span className="text-ink-soft">{bsLabel}</span>
      </div>
    );
  }

  const upcoming = upcomingFestivals(festivals, today, locale);

  function countdown(days: number): string {
    if (days === 0) return t("today");
    if (days === 1) return t("tomorrow");
    return t("inDays", { days: locale === "ne" ? toNepaliDigits(days) : String(days) });
  }

  return (
    <section className="card p-4" aria-label={t("title")}>
      <div className="flex items-center gap-2">
        <CalendarDays size={17} strokeWidth={1.9} className="shrink-0 text-primary" />
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-soft/80">{t("title")}</h2>
      </div>

      <div className="mt-2.5">
        <p className="eyebrow text-ink-soft">{t("today")}</p>
        <p className="text-lg font-semibold text-ink">{bsLabel}</p>
      </div>

      {upcoming.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <p className="eyebrow text-ink-soft">{t("upcoming")}</p>
          {upcoming.map((f) => (
            <div key={f.slug} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-ink">{f.name}</span>
              <span className="shrink-0 text-[13px] font-medium text-ink-soft">{countdown(f.daysUntil)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
