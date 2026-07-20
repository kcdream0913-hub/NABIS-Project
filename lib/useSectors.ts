"use client";

import { useTranslations } from "next-intl";
import { SECTOR_SLUGS, type SectorSlug } from "@/lib/sectors";

export type Sector = { slug: SectorSlug; name: string; description: string };

export function useSectors(): Sector[] {
  const t = useTranslations("sectors");
  return SECTOR_SLUGS.map((slug) => ({
    slug,
    name: t(`${slug}.name`),
    description: t(`${slug}.description`),
  }));
}
