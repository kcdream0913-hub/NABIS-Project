import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Server-only admin gate for Route Handlers that need the service-role client
 *  (invite / ban-unban — GoTrue Admin API operations no RLS policy can express).
 *  Mirrors the SAME admin_users check every other admin surface uses
 *  (admin/page.tsx, admin/layout.tsx, middleware.ts's isAdminPath branch,
 *  admin_delete_account()) — not new authorization logic, just this file's
 *  copy of it for the two routes that run before ever touching service_role.
 *  Returns the admin's user id on success, null otherwise — callers respond
 *  401/403 themselves so each route controls its own error shape. */
export async function requireAdmin(): Promise<{ userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!adminRow) return null;

  return { userId: user.id };
}
