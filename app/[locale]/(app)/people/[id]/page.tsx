import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ContactBusiness from "@/app/[locale]/(app)/business/[id]/contact-business";
import ReportButton from "@/components/ReportButton";
import Avatar from "@/components/Avatar";
import TrustBadge from "@/components/TrustBadge";
import BioText from "@/components/BioText";
import OfferingsSection from "@/components/OfferingsSection";
import ProfileLinks from "@/components/ProfileLinks";
import { SectorChip } from "@/components/chips";
import { trustTier } from "@/lib/trust";
import { pickBio, isAutoBio } from "@/lib/bilingual";
import { canPublishOfferings } from "@/lib/offerings";
import { readPreferences } from "@/lib/preferences";
import { localizeCity } from "@/lib/localizePlace";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("person");
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: person } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (!person) notFound();

  const bio = pickBio(locale, person.bio, person.bio_ne);
  // Phone shows only when the member opted in (sharing_defaults.show_phone); unset
  // resolves to OFF via readPreferences.
  const prefs = readPreferences(person.preferences);
  const showPhone = prefs.sharing_defaults.show_phone && !!person.phone;

  // Sector chips — labelled from the i18n `sectors` map (falls back to the raw slug for a
  // non-sector value), same as the business page. Empty renders nothing.
  const tSectors = await getTranslations("sectors");
  const sectorName = (slug: string) => {
    try {
      return tSectors(`${slug}.name`);
    } catch {
      return slug;
    }
  };
  const sectorChips: { slug: string; name: string }[] = (person.sectors ?? []).map((slug: string) => ({
    slug,
    name: sectorName(slug),
  }));
  // "Member since {Mon YYYY}" from created_at (NOT NULL in prod, but guarded).
  const memberSince = person.created_at
    ? new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(new Date(person.created_at))
    : null;

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-start gap-4">
          <Avatar name={person.name} url={person.avatar_url} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">{person.name ?? t("member")}</h1>
              <TrustBadge
                tier={trustTier(person)}
                label={trustTier(person) === "bridge" ? t("bridgeVerified") : t("verified")}
                size="md"
              />
              <span className="ml-auto">
                <ReportButton targetType="profile" targetId={person.id} />
              </span>
            </div>
            {person.headline && (
              <p className="mt-0.5 text-sm font-medium text-ink">{person.headline}</p>
            )}
            <p className="mt-0.5 text-sm text-ink-soft">{localizeCity(locale, person.city)}</p>
          </div>
        </div>

        {sectorChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sectorChips.map((s) => (
              <SectorChip key={s.slug} label={s.name} />
            ))}
          </div>
        )}

        <ProfileLinks links={person.links} />

        {memberSince && (
          <p className="mt-3 text-xs text-ink-soft">{t("memberSince", { date: memberSince })}</p>
        )}

        {bio && <BioText text={bio.text} origin={bio.origin} auto={isAutoBio(locale, bio, person.bio_ne_auto)} className="mt-4 text-sm leading-relaxed" />}
        {showPhone && (
          <p className="mt-3 text-sm text-ink-soft">
            <span className="font-medium text-ink">{t("phoneLabel")}:</span>{" "}
            <a href={`tel:${person.phone}`} className="text-primary hover:underline">{person.phone}</a>
          </p>
        )}
        <div className="mt-4">
          <ContactBusiness
            ownerUserId={person.id}
            isPaidProvider={false}
            priceAmount={null}
            priceCurrency="USD"
          />
        </div>
      </div>

      <OfferingsSection
        ownerType="profile"
        subjectId={person.id}
        providerOwnerUserId={person.id}
        providerName={person.name ?? t("member")}
        providerAvatarUrl={person.avatar_url}
        providerTier={trustTier(person)}
        subjectHasTourism={canPublishOfferings(person.sectors)}
      />
    </div>
  );
}
