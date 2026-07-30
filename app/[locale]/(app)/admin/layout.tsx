import type { ReactNode } from "react";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

// Defense-in-depth for /admin (and every future /admin/* sub-route). The
// middleware already turns non-admins away before this renders; this server
// component mirrors that check as a fail-closed second layer, so admin code is
// gated even if the middleware matcher ever changes. NOT new authorization
// logic — the same admin_users_select_self RLS check (user_id = auth.uid()).
export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/login", locale });

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user!.id)
    .maybeSingle();
  if (!adminRow) redirect({ href: "/", locale });

  return <>{children}</>;
}
