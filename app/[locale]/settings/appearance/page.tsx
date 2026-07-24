export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { readPreferences } from "@/lib/preferences";
import AppearanceForm from "@/components/settings/AppearanceForm";

export default async function AppearancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = user
    ? await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle()
    : { data: null };
  return <AppearanceForm initialTimezone={readPreferences(data?.preferences).timezone} />;
}
