import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfessionalAccountRow } from "@/app/api/admin/accounts/route";

// Client-side helpers for admin/accounts/page.tsx. Split by what each action
// actually needs:
//   - Professional list/invite/ban: go through /api/admin/accounts/* (need
//     the GoTrue Admin API — email, ban status, invite — no RLS path exists).
//   - Professional hard-delete: the admin_delete_account() SECURITY DEFINER
//     RPC, called directly — it's admin-gated INSIDE Postgres, no service
//     role or route needed.
//   - Business list/create/delete: plain RLS-gated table calls (businesses_
//     select is already open to any authenticated user; businesses_admin_
//     insert/delete are the two new policies BL-ADMIN-ACCOUNTS adds).

export type BusinessAccountRow = {
  id: string;
  name: string;
  owner_user_id: string;
  verification_status: string;
  created_at: string;
};

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string; detail?: string }).detail ?? (body as { error?: string }).error ?? `request_failed_${res.status}`);
  }
  return body as T;
}

export async function listProfessionals(): Promise<ProfessionalAccountRow[]> {
  const res = await fetch("/api/admin/accounts", { method: "GET" });
  const body = await parseJsonOrThrow<{ accounts: ProfessionalAccountRow[] }>(res);
  return body.accounts;
}

export async function inviteProfessional(email: string, name?: string): Promise<{ userId: string }> {
  const res = await fetch("/api/admin/accounts/invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, name }),
  });
  return parseJsonOrThrow<{ userId: string }>(res);
}

export async function setAccountBanned(userId: string, ban: boolean): Promise<void> {
  const res = await fetch("/api/admin/accounts/ban", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, ban }),
  });
  await parseJsonOrThrow<{ ok: true }>(res);
}

/** Hard delete — irreversible, cascades per D-065/D-066. Caller must have
 *  already shown the "this also deletes their owned businesses" warning;
 *  this function does not repeat it. */
export async function hardDeleteAccount(supabase: SupabaseClient, targetUserId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_account", { target_user_id: targetUserId });
  if (error) throw new Error(error.message);
}

export async function listBusinesses(supabase: SupabaseClient): Promise<BusinessAccountRow[]> {
  const { data, error } = await supabase
    .from("businesses")
    .select("id, name, owner_user_id, verification_status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// NOTE (D-068 integration fix): owner-email → id resolution is done in the page
// against the already-loaded `professionals` list (which carries every account's
// email, fetched through the admin-gated service-role /api/admin/accounts route),
// NOT via find_user_id_by_email. That RPC was revoked from `authenticated` on
// 2026-07-22 (F8 email→uid enumeration oracle) — verified still revoked live on
// prod 2026-07-30 (authenticated EXECUTE = false; service_role only) — so calling
// it from the client would permission-fail for the admin too, and re-granting it
// to authenticated would re-open that oracle for the entire user base. The local
// lookup reuses admin-gated data instead, so no new grant/endpoint is needed.

// Returns the new row's id — the caller needs it to audit-log the CREATED
// BUSINESS as the target (target_type "business" must carry a business id,
// not the owner's user id; see the hub's D-068 verification note).
export async function createBusiness(
  supabase: SupabaseClient,
  input: { name: string; primary_sector: string; country_of_registration: string; owner_user_id: string; business_email?: string }
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("businesses")
    .insert({
      name: input.name,
      primary_sector: input.primary_sector,
      country_of_registration: input.country_of_registration,
      owner_user_id: input.owner_user_id,
      business_email: input.business_email || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export async function deleteBusiness(supabase: SupabaseClient, businessId: string): Promise<void> {
  const { error } = await supabase.from("businesses").delete().eq("id", businessId);
  if (error) throw new Error(error.message);
}
