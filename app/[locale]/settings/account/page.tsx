export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import AccountForm from "@/components/settings/AccountForm";
import VerificationCard, { type TrackStatus, type HistoryRow } from "@/components/settings/VerificationCard";
import DeleteAccountButton from "@/components/settings/DeleteAccountButton";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware gates /settings; guard anyway

  // Read-only verification state. RLS scopes each read to the caller.
  const [{ data: profile }, { data: tierRow }, { data: history }] = await Promise.all([
    supabase.from("profiles").select("name, us_verification, np_verification").eq("id", user.id).maybeSingle(),
    supabase.from("user_trust_tiers").select("trust_tier").eq("id", user.id).maybeSingle(),
    supabase
      .from("verification_records")
      .select("created_at, policy_track, status, provider")
      .eq("subject_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const tier = (tierRow?.trust_tier ?? "basic") as "basic" | "verified" | "bridge";

  return (
    <>
      <AccountForm initialName={profile?.name ?? ""} email={user.email ?? ""} />
      <VerificationCard
        tier={tier}
        usStatus={(profile?.us_verification ?? "none") as TrackStatus}
        npStatus={(profile?.np_verification ?? "none") as TrackStatus}
        history={(history ?? []) as HistoryRow[]}
      />
      <DeleteAccountButton />
    </>
  );
}
