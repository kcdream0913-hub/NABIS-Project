export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import MobileConnect from "@/components/settings/MobileConnect";

export default async function DevicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return <MobileConnect currentPhone={user?.phone ?? null} />;
}
