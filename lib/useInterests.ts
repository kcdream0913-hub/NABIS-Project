"use client";

import { useTranslations } from "next-intl";
import { INTEREST_SLUGS, type InterestSlug } from "@/lib/interests";

export type Interest = { slug: InterestSlug; name: string };

export function useInterests(): Interest[] {
  const t = useTranslations("interests");
  return INTEREST_SLUGS.map((slug) => ({ slug, name: t(slug) }));
}
