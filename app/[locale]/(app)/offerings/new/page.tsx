"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import OfferingEditor from "@/components/OfferingEditor";
import { canPublishOfferings } from "@/lib/offerings";

// Create route. Reachable from an owner's own profile or business page. The
// tourism-sector gate is UX here; RLS is the real guard on insert.
export default function NewOfferingPage() {
  const t = useTranslations("offerings");
  const supabase = createClient();
  const router = useRouter();
  const businessId = useSearchParams().get("business");
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      if (businessId) {
        const { data: b } = await supabase
          .from("businesses")
          .select("owner_user_id, primary_sector, secondary_sectors")
          .eq("id", businessId)
          .single();
        const owns = b?.owner_user_id === user.id;
        const tourism = canPublishOfferings([b?.primary_sector, ...((b?.secondary_sectors as string[]) ?? [])]);
        setState(owns && tourism ? "ok" : "denied");
      } else {
        const { data: p } = await supabase.from("profiles").select("sectors").eq("id", user.id).single();
        setState(canPublishOfferings(p?.sectors as string[]) ? "ok" : "denied");
      }
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

  return <OfferingEditor mode="create" ownerType={businessId ? "business" : "profile"} businessId={businessId ?? undefined} />;
}
