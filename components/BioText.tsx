"use client";

import { useTranslations } from "next-intl";
import type { BioOrigin } from "@/lib/bilingual";

// Renders a bio + a subtle origin marker when the shown text isn't in the
// reader's language (e.g. "…bio… (English)"). Client component, so it's usable
// from both server pages and client cards.
export default function BioText({
  text,
  origin,
  className,
}: {
  text: string;
  origin: BioOrigin;
  className?: string;
}) {
  const t = useTranslations("common");
  return (
    <p className={className}>
      {text}
      {origin && (
        <span className="text-ink-soft"> ({t(origin === "en" ? "inEnglish" : "inNepali")})</span>
      )}
    </p>
  );
}
