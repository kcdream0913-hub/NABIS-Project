import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";

// Server-side signed-URL minting for private message attachments. The signed URL
// is generated with the CALLER'S session, so Supabase Storage enforces the
// message_attach_select RLS policy (thread participants only) — a non-participant
// gets a 403 here, never a URL. Short TTL so a leaked link expires quickly.
export const runtime = "nodejs";

const TTL_SECONDS = 60;

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get("path");
  if (!path) return NextResponse.json({ error: "missing path" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, TTL_SECONDS);

  if (error || !data) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return NextResponse.json(
    { url: data.signedUrl },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
