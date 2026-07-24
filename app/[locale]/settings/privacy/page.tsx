export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { readPreferences } from "@/lib/preferences";
import PrivacyForm from "@/components/settings/PrivacyForm";

export default async function PrivacyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = user
    ? await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle()
    : { data: null };
  return <PrivacyForm initial={readPreferences(data?.preferences)} />;
}
