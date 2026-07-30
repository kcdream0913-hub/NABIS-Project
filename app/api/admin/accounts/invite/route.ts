import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminServerAuth";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Admin-only: invite a brand-new Professional account by email. This is the
// ONE step in account creation that genuinely needs the GoTrue Admin API
// (inviteUserByEmail creates the auth.users row + sends the invite email —
// there is no RLS-expressible way to create an auth.users row from a client
// call). handle_new_user() (existing trigger, unchanged) fires on that
// insert and creates the matching profiles row automatically — no extra
// profile-creation code needed here.
//
// "Business" accounts are NOT created here: businesses.owner_user_id is
// NOT NULL, so a business always needs an existing owner. Creating a business
// is a plain RLS-gated insert (see admin/accounts/page.tsx) against an
// EXISTING professional (invited here first, if new) — not a second
// Admin-API call. If you actually want "invite someone who doesn't have an
// account AND immediately become a business owner" as one atomic action,
// that's a real follow-on (a pending-business-invite + claim-on-signup flow),
// not built here — flag it back if that's the intent.

type Body = { email?: string; name?: string };

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "service_role_not_configured" }, { status: 500 });
  }

  const { data, error } = await service.auth.admin.inviteUserByEmail(email, {
    data: body.name ? { name: body.name } : undefined,
  });
  if (error) {
    // Supabase returns a 422-ish "already registered" case as an error here —
    // surface it distinctly so the UI doesn't show a generic failure for what
    // is really "this person already has an account."
    const alreadyExists = /already.*registered|already.*exists/i.test(error.message);
    return NextResponse.json(
      { error: alreadyExists ? "already_registered" : "invite_failed", detail: error.message },
      { status: alreadyExists ? 409 : 500 }
    );
  }

  // Log with the caller's own session (RLS-scoped insert into audit_logs is
  // fine here — admins can always write their own audit rows), not the
  // service client, so actor_id is unambiguous.
  const supabase = await createClient();
  await supabase.from("audit_logs").insert({
    actor_id: admin.userId,
    action: "admin_account_invited",
    target_type: "user",
    target_id: data.user.id,
    metadata: { email },
  });

  return NextResponse.json({ userId: data.user.id });
}
