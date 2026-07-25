"use client";

import {
  Wheat, GraduationCap, Zap, UtensilsCrossed, HeartPulse, Truck, Lightbulb,
  Landmark, Factory, Clapperboard, Scale, Building2, ShoppingBag, Cpu, Mountain,
  type LucideIcon,
} from "lucide-react";
import { useSectors } from "@/lib/useSectors";
import type { SectorSlug } from "../../_lib/serviceCatalog";

// Icon + text always (a11y §10 — icon-only is unusable for a low-literacy owner
// and for a screen reader). Tiles are ≥64px tap targets.
const SECTOR_ICON: Record<SectorSlug, LucideIcon> = {
  "agriculture-food-systems": Wheat,
  "education-human-capital": GraduationCap,
  "energy-hydropower": Zap,
  "food-beverage": UtensilsCrossed,
  "healthcare-life-sciences": HeartPulse,
  "infrastructure-logistics": Truck,
  "innovation-rd": Lightbulb,
  "investment-finance": Landmark,
  "manufacturing-industry": Factory,
  "media-creative-industries": Clapperboard,
  "policy-immigration-legal": Scale,
  "real-estate-home-improvement": Building2,
  "retail-consumer": ShoppingBag,
  "technology-ai": Cpu,
  "tourism-hospitality": Mountain,
};

export default function SectorGrid({
  selected,
  onToggle,
  disabledSlug,
  atMax,
}: {
  selected: string[];
  onToggle: (slug: string) => void;
  disabledSlug?: string; // e.g. the primary sector, when picking secondaries
  atMax?: boolean; // secondary cap reached
}) {
  const sectors = useSectors();
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {sectors.map((s) => {
        const slug = s.slug as SectorSlug;
        const Icon = SECTOR_ICON[slug] ?? Building2;
        const active = selected.includes(slug);
        const disabled = slug === disabledSlug || (!active && !!atMax);
        return (
          <button
            key={slug}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onToggle(slug)}
            className={`flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              active ? "border-primary bg-primary-soft text-primary-pressed" : "border-border-input text-ink hover:bg-surface-2"
            }`}
          >
            <Icon size={26} strokeWidth={1.8} className="shrink-0" aria-hidden />
            <span className="text-xs font-medium leading-tight">{s.name}</span>
          </button>
        );
      })}
    </div>
  );
}
