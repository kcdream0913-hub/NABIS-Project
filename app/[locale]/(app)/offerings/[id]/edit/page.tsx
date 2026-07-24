"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import OfferingEditor from "@/components/OfferingEditor";
import { canPublishOfferings, type Offering, type PublishTarget } from "@/lib/offerings";

// Edit route. Loads the offering (RLS lets the owner read their own draft) and
// confirms ownership before showing the editor; RLS is the real guard on update.
// The "Publish as" selector lets an owner re-assign a mis-owned offering between
// their identities (e.g. move a personal one onto their business).
export default function EditOfferingPage() {
  const t = useTranslations("offerings");
  const supabase = createClient();
  const router = useRouter();
  const id = String(useParams().id);
  const [offering, setOffering] = useState<Offering | null>(null);
  const [targets, setTargets] = useState<PublishTarget[]>([]);
  const [defaultKey, setDefaultKey] = useState("profile");
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

      const [{ data: businesses }, { data: profile }] = await Promise.all([
        supabase
          .from("businesses")
          .select("id, name, owner_user_id, primary_sector, secondary_sectors")
          .eq("owner_user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("sectors").eq("id", user.id).single(),
      ]);
      const owned = businesses ?? [];

      const owns =
        o.owner_type === "profile"
          ? o.profile_id === user.id
          : !!o.business_id && owned.some((b) => b.id === o.business_id);
      if (!owns) {
        setState("denied");
        return;
      }

      // Tourism-eligible identities, plus the offering's current owner (kept even
      // if no longer tourism-eligible, so the current selection stays valid).
      const businessTargets: PublishTarget[] = owned
        .filter(
          (b) =>
            canPublishOfferings([b.primary_sector, ...((b.secondary_sectors as string[]) ?? [])]) ||
            b.id === o.business_id,
        )
        .map((b) => ({ type: "business", id: b.id, name: b.name }));
      const includeProfile = canPublishOfferings(profile?.sectors as string[]) || o.owner_type === "profile";

      const next: PublishTarget[] = [
        ...businessTargets,
        ...(includeProfile ? [{ type: "profile" as const }] : []),
      ];
      const currentKey = o.owner_type === "business" ? (o.business_id ?? "profile") : "profile";

      setOffering(o);
      setTargets(next);
      setDefaultKey(currentKey);
      setState("ok");
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

  return <OfferingEditor mode="edit" targets={targets} defaultTargetKey={defaultKey} offering={offering} />;
}
