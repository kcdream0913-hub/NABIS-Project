export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { readPreferences } from "@/lib/preferences";
import NotificationsForm from "@/components/settings/NotificationsForm";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = user
    ? await supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle()
    : { data: null };
  return <NotificationsForm initial={readPreferences(data?.preferences)} />;
}
