import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ContactBusiness from "@/app/[locale]/business/[id]/contact-business";
import ReportButton from "@/components/ReportButton";
import Avatar from "@/components/Avatar";
import TrustBadge from "@/components/TrustBadge";
import { trustTier } from "@/lib/trust";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("person");
  const supabase = await createClient();

  const { data: person } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (!person) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-lg border border-border bg-white p-5">
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
            <p className="mt-0.5 text-sm text-ink-soft">{person.city}</p>
          </div>
        </div>
        {person.bio && <p className="mt-4 text-sm leading-relaxed">{person.bio}</p>}
        <div className="mt-4">
          <ContactBusiness
            ownerUserId={person.id}
            isPaidProvider={false}
            priceAmount={null}
            priceCurrency="USD"
          />
        </div>
      </div>
    </div>
  );
}
