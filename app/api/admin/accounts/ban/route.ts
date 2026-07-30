import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminServerAuth";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Admin-only: "soft-delete" a Professional account by BANNING it, not by
// deleting data. Chosen over inventing a profiles.deactivated_at column: the
// platform already has a reversible, built-in mechanism (GoTrue's
// ban_duration) that blocks login while leaving every row intact — an admin
// can unban later with zero data loss. Hard delete (irreversible, cascades
// per D-065/D-066) is the separate admin_delete_account() RPC, called
// directly from the client — it needs no service role, so it isn't in this
// route.
//
// ban_duration is a GoTrue Admin API field with no SQL/RLS surface, which is
// why this — like invite — is the one place this feature needs the
// service-role client.

type Body = { userId?: string; ban?: boolean };

// ~100 years — GoTrue has no "permanent" literal; this is the accepted
// idiom for "until explicitly unbanned."
const BAN_DURATION = "876000h";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 403 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.userId || typeof body.ban !== "boolean") {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (body.userId === admin.userId) {
    return NextResponse.json({ error: "cannot_ban_self" }, { status: 400 });
  }

  const service = createServiceClient();
  if (!service) {
    return NextResponse.json({ error: "service_role_not_configured" }, { status: 500 });
  }

  const { error } = await service.auth.admin.updateUserById(body.userId, {
    ban_duration: body.ban ? BAN_DURATION : "none",
  });
  if (error) {
    return NextResponse.json({ error: "ban_update_failed", detail: error.message }, { status: 500 });
  }

  const supabase = await createClient();
  await supabase.from("audit_logs").insert({
    actor_id: admin.userId,
    action: body.ban ? "admin_account_banned" : "admin_account_unbanned",
    target_type: "user",
    target_id: body.userId,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
