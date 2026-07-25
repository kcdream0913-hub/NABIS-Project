"use client";

import { useLocale } from "next-intl";
import type { Chip, Locale } from "../../_lib/serviceCatalog";

// Multi-select chip group (G3 services, G4 customers). ≥56px tap targets. Labels
// come from the catalog's own en/ne — the assembler reads the same source, so
// what the owner taps is exactly what the bio says.
export default function ChipMultiSelect({
  chips,
  selected,
  onToggle,
}: {
  chips: readonly Chip[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const locale = useLocale() as Locale;
  return (
    <div className="flex flex-wrap gap-2.5">
      {chips.map((c) => {
        const active = selected.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(c.id)}
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
