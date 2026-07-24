"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import OfferingCard, { type OfferingCardProvider } from "./OfferingCard";
import { pickFestivalName, type Festival, type Offering, type OfferingOwnerType } from "@/lib/offerings";
import type { TrustTier } from "@/lib/trust";

// The "Offerings" tab content for a profile or business detail page. RLS already
// scopes what loads: published rows to everyone, plus the owner's own drafts. So
// the section shows for anyone when there are published offerings, and always for
// the owner (who can add + see drafts with a status chip).
export default function OfferingsSection({
  ownerType,
  subjectId,
  providerOwnerUserId,
  providerName,
  providerAvatarUrl,
  providerTier,
  subjectHasTourism,
}: {
  ownerType: OfferingOwnerType;
  subjectId: string;
  providerOwnerUserId: string; // the user who can manage these offerings
  providerName: string;
  providerAvatarUrl?: string | null;
  providerTier: TrustTier;
  subjectHasTourism: boolean;
}) {
  const t = useTranslations("offerings");
  const locale = useLocale();
  const supabase = createClient();
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [festivalNames, setFestivalNames] = useState<Record<string, string>>({});
  const [viewerIsOwner, setViewerIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const col = ownerType === "business" ? "business_id" : "profile_id";
      const [{ data: rows }, { data: user }, { data: fests }] = await Promise.all([
        supabase.from("offerings").select("*").eq(col, subjectId).order("created_at", { ascending: false }),
        supabase.auth.getUser(),
        supabase.from("festivals").select("*"),
      ]);
      if (!active) return;
      setOfferings((rows as Offering[]) ?? []);
      setViewerIsOwner(user.user?.id === providerOwnerUserId);
      const map: Record<string, string> = {};
      for (const f of (fests as Festival[]) ?? []) map[f.slug] = pickFestivalName(locale, f);
      setFestivalNames(map);
      setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerType, subjectId, providerOwnerUserId, locale]);

  if (loading) return null;
  // Nothing to show and the viewer can't manage → render no section at all.
  if (offerings.length === 0 && !viewerIsOwner) return null;

  const provider: OfferingCardProvider = {
    name: providerName,
    avatarUrl: providerAvatarUrl,
    tier: providerTier,
    ownerType,
    subjectId,
  };
  const canManage = viewerIsOwner && subjectHasTourism;
  const newHref = ownerType === "business" ? `/offerings/new?business=${subjectId}` : "/offerings/new";

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{t("sectionTitle")}</h2>
        {canManage && (
          <Link
            href={newHref}
            className="ml-auto rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-on-primary hover:bg-primary-pressed"
          >
            {t("addOffering")}
          </Link>
        )}
      </div>

      {offerings.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-border p-4 text-sm text-ink-soft">
          {canManage ? t("ownerEmpty") : t("empty")}
        </p>
      ) : (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {offerings.map((o) => (
            <OfferingCard
              key={o.id}
              offering={o}
              provider={provider}
              festivalNames={festivalNames}
              manageable={viewerIsOwner}
            />
          ))}
        </div>
      )}
    </div>
  );
}
