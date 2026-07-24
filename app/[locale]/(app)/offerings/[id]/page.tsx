import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/components/Avatar";
import TrustBadge from "@/components/TrustBadge";
import BioText from "@/components/BioText";
import InquireButton from "@/components/InquireButton";
import { trustTier, type TrustTier } from "@/lib/trust";
import { pickBio } from "@/lib/bilingual";
import { formatMoney, pickFestivalName, type Festival, type Offering } from "@/lib/offerings";

export default async function OfferingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("offerings");
  const tCommon = await getTranslations("common");
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: offeringRow } = await supabase.from("offerings").select("*").eq("id", id).single();
  if (!offeringRow) notFound();
  const offering = offeringRow as Offering;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Resolve the provider. Businesses are world-readable; a private profile may be
  // hidden by RLS, so fall back to a neutral label but keep the real user id (from
  // the offering row) so Inquire still works.
  let providerName = t("member");
  let providerAvatar: string | null = null;
  let providerTier: TrustTier = "none";
  let providerUserId = "";
  let providerHref = "#";
  let providerIsBusiness = false;

  if (offering.owner_type === "business" && offering.business_id) {
    providerIsBusiness = true;
    const { data: b } = await supabase
      .from("businesses")
      .select("id, name, logo_url, owner_user_id, verification_status")
      .eq("id", offering.business_id)
      .single();
    if (b) {
      providerName = b.name;
      providerAvatar = b.logo_url;
      providerTier = trustTier({ verification_status: b.verification_status });
      providerUserId = b.owner_user_id;
      providerHref = `/business/${b.id}`;
    }
  } else if (offering.profile_id) {
    providerUserId = offering.profile_id;
    providerHref = `/people/${offering.profile_id}`;
    const { data: p } = await supabase
      .from("profiles")
      .select("id, name, avatar_url, verification_status, bridge")
      .eq("id", offering.profile_id)
      .single();
    if (p) {
      providerName = p.name ?? t("member");
      providerAvatar = p.avatar_url;
      providerTier = trustTier(p);
    }
  }

  const isOwner = !!user && user.id === providerUserId;

  const festivalNames: Record<string, string> = {};
  if (offering.festival_slugs.length) {
    const { data: fests } = await supabase.from("festivals").select("*").in("slug", offering.festival_slugs);
    for (const f of (fests as Festival[]) ?? []) festivalNames[f.slug] = pickFestivalName(locale, f);
  }

  const title = pickBio(locale, offering.title, offering.title_ne);
  const desc = pickBio(locale, offering.description, offering.description_ne);
  const price = formatMoney(offering.price_from, offering.price_currency);
  const trustLabel =
    providerTier === "bridge"
      ? tCommon("bridgeVerified")
      : providerIsBusiness
        ? tCommon("verifiedBusiness")
        : tCommon("verified");

  const facts: { label: string; value: string }[] = [];
  if (offering.country) facts.push({ label: t("fieldCountry"), value: t(`country.${offering.country}`) });
  if (offering.region) facts.push({ label: t("fieldRegion"), value: offering.region });
  if (offering.duration_days != null) facts.push({ label: t("fieldDuration"), value: t("daysCount", { count: offering.duration_days }) });
  if (offering.group_min != null || offering.group_max != null)
    facts.push({ label: t("fieldGroup"), value: `${offering.group_min ?? 1}–${offering.group_max ?? "∞"}` });
  if (offering.available_from || offering.available_to)
    facts.push({ label: t("fieldAvailability"), value: `${offering.available_from ?? "…"} → ${offering.available_to ?? "…"}` });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-chip-ink">
            {t(`types.${offering.type}`)}
          </span>
          {offering.status !== "published" && (
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
              {t(`status.${offering.status}`)}
            </span>
          )}
          {isOwner && (
            <Link href={`/offerings/${offering.id}/edit`} className="ml-auto text-[13px] font-medium text-primary hover:underline">
              {t("edit")}
            </Link>
          )}
        </div>

        <h1 className="mt-2 text-xl font-semibold tracking-tight text-ink">{title?.text ?? t("untitled")}</h1>

        {price && (
          <p className="mt-1 text-lg font-semibold text-ink">
            {price}
            <span className="text-sm font-normal text-ink-soft"> {t(`units.${offering.price_unit}`)}</span>
          </p>
        )}

        {/* provider */}
        <div className="mt-3 flex items-center gap-2">
          <Link href={providerHref} className="flex items-center gap-2 text-sm text-ink hover:underline">
            <Avatar name={providerName} url={providerAvatar} size={28} shape={providerIsBusiness ? "rounded" : "circle"} />
            <span className="font-medium">{providerName}</span>
          </Link>
          <TrustBadge tier={providerTier} label={trustLabel} />
        </div>

        {desc && <BioText text={desc.text} origin={desc.origin} className="mt-4 text-sm leading-relaxed text-ink" />}

        {facts.length > 0 && (
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-[11px] uppercase tracking-wide text-ink-soft">{f.label}</dt>
                <dd className="text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {(offering.seasons.length > 0 || offering.festival_slugs.length > 0 || offering.direction_tags.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {offering.direction_tags.map((d) => (
              <span key={d} className="rounded-full bg-view-bridge-soft px-2 py-0.5 text-[11px] font-medium text-view-bridge">
                {t(`directions.${d}`)}
              </span>
            ))}
            {offering.seasons.map((s) => (
              <span key={s} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-ink-soft">
                {t(`seasons.${s}`)}
              </span>
            ))}
            {offering.festival_slugs.map((f) => (
              <span key={f} className="rounded-full bg-bridge-soft px-2 py-0.5 text-[11px] font-medium text-on-bridge">
                {festivalNames[f] ?? f}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5">
          {isOwner ? (
            <p className="text-sm text-ink-soft">{t("ownerViewNote")}</p>
          ) : providerUserId ? (
            <InquireButton providerUserId={providerUserId} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
