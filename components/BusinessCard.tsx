"use client";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Avatar from "./Avatar";
import TrustBadge from "./TrustBadge";
import { Cover } from "./ui/Cover";
import { ViewChip, SectorChip } from "./chips";
import { trustTier } from "@/lib/trust";

export interface BusinessCardProps {
  id: string; name: string; logoUrl?: string | null; bio?: string | null;
  primarySector?: string | null; secondarySectors?: string[] | null;
  view?: "us" | "nepal" | "bridge";
  verificationStatus: "verified" | "unverified"; tier?: "bridge";
  isPaidProvider?: boolean; accessPriceAmount?: number | null; accessPriceCurrency?: string | null;
  viewLabel?: string; // localized view chip label
}

export default function BusinessCard(b: BusinessCardProps) {
  const t = useTranslations("card");
  const tCommon = useTranslations("common");
  const isBridge = b.tier === "bridge";
  // Businesses have no corridor tier, so this resolves to "verified" at most.
  const tier = trustTier({ verification_status: b.verificationStatus, bridge: isBridge });

  return (
    <div className="card card-hover overflow-hidden">
      <Cover accent={isBridge ? "bridge" : "brand"} />
      <div className="px-4 pb-4">
        <span className="relative -mt-8 inline-block">
          <span className={isBridge ? "block rounded-2xl p-[2px]" : ""} style={isBridge ? { boxShadow: "0 0 0 2px var(--color-bridge)" } : undefined}>
            <Avatar name={b.name} url={b.logoUrl} size={64} shape="rounded" />
          </span>
        </span>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] font-semibold tracking-[-.01em] text-ink">{b.name}</h3>
          <TrustBadge tier={tier} label={tCommon("verifiedBusiness")} />
          {b.isPaidProvider && b.accessPriceAmount != null && (
            <span className="rounded-full bg-bridge-soft px-2 py-0.5 text-[11px] font-semibold text-on-bridge">
              {b.accessPriceCurrency} {b.accessPriceAmount}
            </span>
          )}
        </div>
        {b.bio && <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{b.bio}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {b.view && <ViewChip view={b.view} label={b.viewLabel} />}
          {b.primarySector && <SectorChip label={b.primarySector} primary />}
          {(b.secondarySectors ?? []).slice(0, 2).map((s) => <SectorChip key={s} label={s} />)}
        </div>

        <div className="mt-4 flex gap-2">
          <Link href={`/business/${b.id}`} className="flex-1 rounded-xl bg-primary px-3.5 py-2 text-center text-sm font-semibold text-on-primary transition hover:bg-primary-pressed">{t("contact")}</Link>
          <Link href={`/business/${b.id}`} className="flex-1 rounded-xl border border-border px-3.5 py-2 text-center text-sm font-semibold text-ink transition hover:bg-surface-2">{t("viewCompany")}</Link>
        </div>
      </div>
    </div>
  );
}
