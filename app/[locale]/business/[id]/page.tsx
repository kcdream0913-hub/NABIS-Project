import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ContactBusiness from "./contact-business";
import TeamManager from "./team-manager";
import RemoveMemberButton from "./remove-member-button";
import ReportButton from "@/components/ReportButton";

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("business");
  const roleLabel: Record<string, string> = {
    owner: t("roleOwner"),
    professional: t("roleProfessional"),
    assistant: t("roleAssistant"),
    employee: t("roleEmployee"),
  };
  const supabase = await createClient();

  const { data: business } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", id)
    .single();

  if (!business) notFound();

  const { data: members } = await supabase
    .from("business_members")
    .select("id, role, verified_via, can_post, profiles:user_id ( id, name, avatar_url, verification_status )")
    .eq("business_id", id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border border-line bg-white p-5">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-pine-soft text-lg font-bold text-pine">
            {business.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">{business.name}</h1>
              {business.verification_status === "verified" && (
                <span className="rounded bg-bg-success px-2 py-0.5 text-[11px] font-semibold text-text-success">
                  {t("verifiedBusiness")}
                </span>
              )}
              <span className="ml-auto">
                <ReportButton targetType="business" targetId={business.id} />
              </span>
            </div>
            <p className="mt-0.5 text-sm text-ink-soft">
              {business.sector} · {business.country_of_registration}
            </p>
            {business.is_paid_provider && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-gold-soft px-2.5 py-1 text-sm font-medium text-gold">
                {t("access")}: {business.access_price_currency} {business.access_price_amount}
              </div>
            )}
          </div>
        </div>
        {business.bio && <p className="mt-4 text-sm leading-relaxed">{business.bio}</p>}
        <div className="mt-4">
          <ContactBusiness
            ownerUserId={business.owner_user_id}
            isPaidProvider={business.is_paid_provider}
            priceAmount={business.access_price_amount}
            priceCurrency={business.access_price_currency}
          />
        </div>
      </div>

      <div className="mt-5">
        <h2 className="text-sm font-semibold">{t("team")}</h2>
        <div className="mt-2 space-y-2">
          {(members ?? []).map((m) => {
            const person = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-line bg-white p-3"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pine-soft text-xs font-bold text-pine">
                  {(person?.name ?? "?").slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{person?.name ?? t("pending")}</p>
                  <p className="text-xs text-ink-soft">
                    {roleLabel[m.role] ?? m.role}
                    {m.verified_via === "business" ? ` · ${t("verifiedViaBusiness")}` : ""}
                    {m.can_post ? ` · ${t("canPost")}` : ""}
                  </p>
                </div>
                <RemoveMemberButton businessId={id} memberRowId={m.id} role={m.role} />
              </div>
            );
          })}
        </div>
        <TeamManager businessId={id} />
      </div>
    </div>
  );
}
