import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminServerAuth";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

// Admin-only: list Professional accounts with email + ban status. This is a
// GET, not a mutation, but it still needs the service-role client — email and
// banned_until live on auth.users, which no client-callable query can read
// (by design; there is no "select from auth.users" RLS path, and shouldn't
// be). Businesses are NOT listed here: businesses_select is already
// `true`-qualed for any authenticated user (existing policy, unchanged), so
// admin/accounts/page.tsx queries them directly with the ordinary client —
// no service role, no route, needed for that half.
//
// Pagination: single page, perPage=200. Fine at current seed-pilot scale
// (verified live: admin_users has 1 row, businesses/verification_records are
// in the tens) — revisit with real pagination if the user base grows past
// low hundreds.

export type ProfessionalAccountRow = {
  id: string;
  email: string | null;
  name: string | null;
  createdAt: string;
  bannedUntil: string | null;
  isAdmin: boolean;
};

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "service_role_not_configured" }, { status: 500 });
  }

  const [{ data: userPage, error: usersError }, { data: profiles }, { data: adminRows }] = await Promise.all([
    service.auth.admin.listUsers({ page: 1, perPage: 200 }),
    service.from("profiles").select("id, name"),
    service.from("admin_users").select("user_id"),
  ]);
  if (usersError) {
    return NextResponse.json({ error: "list_failed", detail: usersError.message }, { status: 500 });
  }

  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, p.name as string | null]));
  const adminIds = new Set((adminRows ?? []).map((a) => a.user_id as string));

  const rows: ProfessionalAccountRow[] = userPage.users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    name: nameById.get(u.id) ?? null,
    createdAt: u.created_at,
    bannedUntil: u.banned_until && u.banned_until !== "none" ? u.banned_until : null,
    isAdmin: adminIds.has(u.id),
  }));

  return NextResponse.json({ accounts: rows });
}
