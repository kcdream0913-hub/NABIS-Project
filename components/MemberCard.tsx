"use client";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Avatar from "./Avatar";
import TrustBadge from "./TrustBadge";
import { OnlineDot } from "./OnlineDot";
import { Cover } from "./ui/Cover";
import { ViewChip, SectorChip } from "./chips";
import { trustTier } from "@/lib/trust";
import { findOrCreateThread } from "@/lib/threads";

export interface MemberCardProps {
  id: string; name: string; avatarUrl?: string | null;
  headline?: string | null; location?: string | null; sector?: string | null;
  view?: "us" | "nepal" | "bridge";
  verification: "verified" | "unverified"; tier?: "bridge";
  online?: boolean;
  viewLabel?: string; // localized view chip label (falls back to the chip default)
}

export default function MemberCard(p: MemberCardProps) {
  const t = useTranslations("card");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const isBridge = p.tier === "bridge";
  const tier = trustTier({ verification_status: p.verification, bridge: isBridge });
  const trustLabel = tCommon(tier === "bridge" ? "bridgeVerified" : "verified");

  return (
    <div className="card card-hover overflow-hidden">
      <Cover accent={isBridge ? "bridge" : "brand"} />
      <div className="px-4 pb-4">
        <span className="relative -mt-8 inline-block">
          <span className={isBridge ? "block rounded-full p-[2px]" : ""} style={isBridge ? { boxShadow: "0 0 0 2px var(--color-bridge)" } : undefined}>
            <Avatar name={p.name} url={p.avatarUrl} size={64} />
          </span>
          {p.online && <OnlineDot className="absolute bottom-0.5 right-0.5" />}
        </span>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <h3 className="text-[17px] font-semibold tracking-[-.01em] text-ink">{p.name}</h3>
          <TrustBadge tier={tier} label={trustLabel} />
        </div>
        {p.headline && <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{p.headline}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {p.view && <ViewChip view={p.view} label={p.viewLabel} />}
          {p.location && <span className="text-[13px] text-ink-soft">{p.location}</span>}
          {p.sector && <SectorChip label={p.sector} primary />}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={async () => {
              const threadId = await findOrCreateThread(p.id);
              if (threadId) router.push(`/messages/${threadId}`);
            }}
            className="flex-1 rounded-xl bg-primary px-3.5 py-2 text-center text-sm font-semibold text-on-primary transition hover:bg-primary-pressed"
          >
            {t("message")}
          </button>
          <Link href={`/people/${p.id}`} className="flex-1 rounded-xl border border-border px-3.5 py-2 text-center text-sm font-semibold text-ink transition hover:bg-surface-2">{t("viewProfile")}</Link>
        </div>
      </div>
    </div>
  );
}
