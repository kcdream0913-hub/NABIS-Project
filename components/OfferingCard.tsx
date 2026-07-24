"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import Avatar from "./Avatar";
import TrustBadge from "./TrustBadge";
import BioText from "./BioText";
import { pickBio } from "@/lib/bilingual";
import { formatMoney, type Offering, type OfferingOwnerType } from "@/lib/offerings";
import type { TrustTier } from "@/lib/trust";

// Reusable offering card. Commit C's planner consumes the same component, so it
// takes everything it needs by prop and does no data fetching of its own.
export interface OfferingCardProvider {
  name: string;
  avatarUrl?: string | null;
  tier: TrustTier;
  ownerType: OfferingOwnerType;
  subjectId: string; // business id or profile id → the provider's page
}

export default function OfferingCard({
  offering,
  provider,
  festivalNames,
  manageable = false,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  offering: Offering;
  provider: OfferingCardProvider;
  festivalNames?: Record<string, string>;
  manageable?: boolean;
  // Planner "compare" context: render a selection checkbox in the card header.
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const t = useTranslations("offerings");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const title = pickBio(locale, offering.title, offering.title_ne);
  const desc = pickBio(locale, offering.description, offering.description_ne);
  const price = formatMoney(offering.price_from, offering.price_currency);
  const providerHref =
    provider.ownerType === "business" ? `/business/${provider.subjectId}` : `/people/${provider.subjectId}`;
  const trustLabel =
    provider.tier === "bridge"
      ? tCommon("bridgeVerified")
      : provider.ownerType === "business"
        ? tCommon("verifiedBusiness")
        : tCommon("verified");

  return (
    <div className="card overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-2">
          {selectable && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              aria-label={t("compareSelect")}
              className="h-4 w-4 shrink-0 accent-primary"
            />
          )}
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-chip-ink">
            {t(`types.${offering.type}`)}
          </span>
          {offering.status !== "published" && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
              {t(`status.${offering.status}`)}
            </span>
          )}
          {price && (
            <span className="ml-auto text-sm font-semibold text-ink">
              {price}
              <span className="text-[11px] font-normal text-ink-soft"> {t(`units.${offering.price_unit}`)}</span>
            </span>
          )}
        </div>

        <h3 className="mt-2 text-[15px] font-semibold tracking-[-.01em] text-ink">
          <Link href={`/offerings/${offering.id}`} className="hover:underline">
            {title?.text ?? t("untitled")}
          </Link>
        </h3>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-soft">
          {offering.region && <span>{offering.region}</span>}
          {offering.country && <span>· {t(`country.${offering.country}`)}</span>}
          {offering.duration_days != null && <span>· {t("daysCount", { count: offering.duration_days })}</span>}
        </div>

        {desc && <BioText text={desc.text} origin={desc.origin} className="mt-1.5 line-clamp-2 text-sm text-ink-soft" />}

        {(offering.seasons.length > 0 || offering.festival_slugs.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {offering.seasons.map((s) => (
              <span key={s} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-soft">
                {t(`seasons.${s}`)}
              </span>
            ))}
            {offering.festival_slugs.map((f) => (
              <span key={f} className="rounded-full bg-bridge-soft px-2 py-0.5 text-[11px] font-medium text-on-bridge">
                {festivalNames?.[f] ?? f}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <Link href={providerHref} className="flex min-w-0 items-center gap-1.5 text-sm text-ink hover:underline">
            <Avatar
              name={provider.name}
              url={provider.avatarUrl}
              size={22}
              shape={provider.ownerType === "business" ? "rounded" : "circle"}
            />
            <span className="truncate font-medium">{provider.name}</span>
          </Link>
          <TrustBadge tier={provider.tier} label={trustLabel} />
          <span className="ml-auto flex shrink-0 gap-2">
            {manageable && (
              <Link href={`/offerings/${offering.id}/edit`} className="text-[13px] font-medium text-primary hover:underline">
                {t("edit")}
              </Link>
            )}
            <Link href={`/offerings/${offering.id}`} className="text-[13px] font-medium text-primary hover:underline">
              {t("view")}
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}
