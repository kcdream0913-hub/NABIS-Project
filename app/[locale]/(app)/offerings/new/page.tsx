"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import OfferingEditor from "@/components/OfferingEditor";
import { canPublishOfferings, defaultPublishTargetKey, type PublishTarget } from "@/lib/offerings";

// Create route. Reachable from an owner's own profile or business page. The
// tourism-sector gate is UX here; RLS is the real guard on insert. A user who
// owns tourism business(es) gets a "Publish as" selector, defaulting to the
// business so the offering lands on that business's Offerings tab (bug fix).
export default function NewOfferingPage() {
  const t = useTranslations("offerings");
  const supabase = createClient();
  const router = useRouter();
  const businessId = useSearchParams().get("business");
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [targets, setTargets] = useState<PublishTarget[]>([]);
  const [defaultKey, setDefaultKey] = useState("profile");

  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const [{ data: businesses }, { data: profile }] = await Promise.all([
        supabase
          .from("businesses")
          .select("id, name, primary_sector, secondary_sectors")
          .eq("owner_user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("sectors").eq("id", user.id).single(),
      ]);

      // Only tourism-eligible identities can publish (D-019).
      const businessTargets: PublishTarget[] = (businesses ?? [])
        .filter((b) =>
          canPublishOfferings([b.primary_sector, ...((b.secondary_sectors as string[]) ?? [])]),
        )
        .map((b) => ({ type: "business", id: b.id, name: b.name }));
      const profileEligible = canPublishOfferings(profile?.sectors as string[]);

      const next: PublishTarget[] = [
        ...businessTargets,
        ...(profileEligible ? [{ type: "profile" as const }] : []),
      ];

      if (next.length === 0) {
        setState("denied");
        return;
      }
      setTargets(next);
      // A `?business=` deep link (from a business page) preselects that business.
      setDefaultKey(defaultPublishTargetKey(next, businessId));
      setState("ok");
    }
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  if (state === "loading") return <p className="p-6 text-sm text-ink-soft">{t("loading")}</p>;
  if (state === "denied")
    return (
      <div className="mx-auto max-w-xl p-6">
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-soft">{t("notEligible")}</p>
      </div>
    );

  return <OfferingEditor mode="create" targets={targets} defaultTargetKey={defaultKey} />;
}
