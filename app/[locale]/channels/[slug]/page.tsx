import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import EmptyState from "@/components/EmptyState";
import Avatar from "@/components/Avatar";
import TrustBadge from "@/components/TrustBadge";

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations("channels");
  const supabase = await createClient();

  const { data: channel } = await supabase
    .from("channels")
    .select("id, slug, name, description, sector")
    .eq("slug", slug)
    .single();

  if (!channel) notFound();

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name, bio, country_of_registration, primary_sector, secondary_sectors, verification_status, is_paid_provider, access_price_amount, access_price_currency, logo_url")
    .or(`primary_sector.eq.${channel.sector},secondary_sectors.cs.{${channel.sector}}`);

  return (
    <div>
      <p className="eyebrow text-ink-soft">{t("channelEyebrow")}</p>
      <h1 className="mt-0.5 text-xl font-semibold tracking-tight"># {channel.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">{channel.description}</p>

      <div className="mt-4 space-y-3">
        {!businesses || businesses.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={t("emptyTitle")}
            body={t("detailSubtitle")}
            actionHref="/business/new"
            actionLabel={t("registerCta")}
          />
        ) : (
          businesses.map((b) => (
            <Link
              key={b.id}
              href={`/business/${b.id}`}
              className="flex items-start gap-3 rounded-lg border border-line bg-white p-4 hover:border-pine"
            >
              <Avatar name={b.name} url={b.logo_url} shape="rounded" size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{b.name}</p>
                  {b.verification_status === "verified" ? (
                    <TrustBadge tier="verified" label={t("verifiedBusiness")} />
                  ) : (
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                      {t("listed")}
                    </span>
                  )}
                  {b.primary_sector !== channel.sector && (
                    <span className="rounded bg-mist px-1.5 py-0.5 text-[10px] font-medium text-ink-soft">
                      {t("secondaryTag")}
                    </span>
                  )}
                  {b.is_paid_provider && (
                    <span className="rounded bg-gold-soft px-1.5 py-0.5 text-[10px] font-semibold text-gold">
                      {b.access_price_currency} {b.access_price_amount}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{b.bio}</p>
                <p className="mt-1 text-xs text-ink-soft">{b.country_of_registration}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
