"use client";

import { useLocale } from "next-intl";
import type { Chip, Locale } from "../../_lib/serviceCatalog";

// Single-select chip group (G4b years, G5b cross-border). ≥56px tap targets.
export default function ChipSingleSelect({
  chips,
  value,
  onSelect,
}: {
  chips: readonly Chip[];
  value: string | null;
  onSelect: (id: string) => void;
}) {
  const locale = useLocale() as Locale;
  return (
    <div className="flex flex-wrap gap-2.5">
      {chips.map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(c.id)}
            className={`min-h-[56px] rounded-xl border px-4 text-sm font-medium transition-colors ${
              active ? "border-primary bg-primary-soft text-primary-pressed" : "border-border-input text-ink hover:bg-surface-2"
            }`}
          >
            {c[locale]}
          </button>
        );
      })}
    </div>
  );
}
