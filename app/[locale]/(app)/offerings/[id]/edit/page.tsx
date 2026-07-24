"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import OfferingEditor from "@/components/OfferingEditor";
import type { Offering } from "@/lib/offerings";

// Edit route. Loads the offering (RLS lets the owner read their own draft) and
// confirms ownership before showing the editor; RLS is the real guard on update.
export default function EditOfferingPage() {
  const t = useTranslations("offerings");
  const supabase = createClient();
  const router = useRouter();
  const id = String(useParams().id);
  const [offering, setOffering] = useState<Offering | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      const { data } = await supabase.from("offerings").select("*").eq("id", id).single();
      const o = data as Offering | null;
      if (!o) {
        setState("denied");
        return;
      }
      let owns = false;
      if (o.owner_type === "profile") {
        owns = o.profile_id === user.id;
      } else if (o.business_id) {
        const { data: b } = await supabase.from("businesses").select("owner_user_id").eq("id", o.business_id).single();
        owns = b?.owner_user_id === user.id;
      }
      setOffering(o);
      setState(owns ? "ok" : "denied");
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (state === "loading") return <p className="p-6 text-sm text-ink-soft">{t("loading")}</p>;
  if (state === "denied" || !offering)
    return (
      <div className="mx-auto max-w-xl p-6">
        <p className="rounded-lg border border-border bg-surface p-4 text-sm text-ink-soft">{t("notEligible")}</p>
      </div>
    );

  return (
    <OfferingEditor
      mode="edit"
      ownerType={offering.owner_type}
      businessId={offering.business_id ?? undefined}
      offering={offering}
    />
  );
}
