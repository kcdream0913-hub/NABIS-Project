"use client";

import { useTranslations } from "next-intl";
import type { BioOrigin } from "@/lib/bilingual";

// Renders a bio + a subtle marker. Two distinct markers:
//   - origin: the shown text isn't in the reader's language ("…bio… (English)")
//   - auto: the shown text IS the active-locale Nepali bio, but it's an unreviewed
//     machine translation ("…bio… · Auto-translated"). Only one applies at a time
//     (auto is meaningful only when origin is null — the active-locale bio is shown).
export default function BioText({
  text,
  origin,
  auto = false,
  className,
}: {
  text: string;
  origin: BioOrigin;
  auto?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  return (
    <p className={className}>
      {text}
      {origin ? (
        <span className="text-ink-soft"> ({t(origin === "en" ? "inEnglish" : "inNepali")})</span>
      ) : auto ? (
        <span className="text-ink-soft"> · {t("autoTranslated")}</span>
      ) : null}
    </p>
  );
}
