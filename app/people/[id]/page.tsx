import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ContactBusiness from "@/app/business/[id]/contact-business";
import ReportButton from "@/components/ReportButton";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: person } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (!person) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-lg border border-line bg-white p-5">
        <div className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-pine-soft text-lg font-bold text-pine">
            {(person.name ?? "?").slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">{person.name ?? "Member"}</h1>
              {person.verification_status === "verified" && (
                <span className="rounded bg-bg-success px-2 py-0.5 text-[11px] font-semibold text-text-success">
                  Verified
                </span>
              )}
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
