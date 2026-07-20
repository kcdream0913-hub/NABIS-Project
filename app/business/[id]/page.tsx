import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  professional: "Professional",
  assistant: "Assistant",
  employee: "Employee",
};

export default async function BusinessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
                  Verified Business
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-ink-soft">
              {business.sector} · {business.country_of_registration}
            </p>
            {business.is_paid_provider && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-gold-soft px-2.5 py-1 text-sm font-medium text-gold">
                Access: {business.access_price_currency} {business.access_price_amount}
              </div>
            )}
          </div>
        </div>
        {business.bio && <p className="mt-4 text-sm leading-relaxed">{business.bio}</p>}
      </div>

      <div className="mt-5">
        <h2 className="text-sm font-semibold">Team</h2>
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
                  <p className="text-sm font-semibold">{person?.name ?? "Pending"}</p>
                  <p className="text-xs text-ink-soft">
                    {ROLE_LABEL[m.role] ?? m.role}
                    {m.verified_via === "business" ? " · verified via business" : ""}
                    {m.can_post ? " · can post" : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
