import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";
import { sniffMagic, SNIFF_HEAD_BYTES } from "@/lib/attachmentSniff";

// Server-side signed-URL minting for private message attachments. The signed URL is
// generated with the CALLER'S session, so Supabase Storage enforces the
// message_attach_select RLS policy (thread participants only) — a non-participant
// gets a 403 here, never a URL. Short TTL so a leaked link expires quickly.
//
// D-052 — UNSKIPPABLE MAGIC-BYTE GATE: before returning the URL we fetch the head
// bytes of the object and sniff its true type. If the bytes are not an allowlisted
// type (e.g. an .exe renamed "invoice.pdf", or any archive/executable), we return
// 403 and NEVER hand back a URL — so even a message row inserted by a malicious
// client referencing an unscanned file can never DELIVER it. Fails CLOSED: if the
// head can't be read/verified, we do not mint a URL.
export const runtime = "nodejs";

const TTL_SECONDS = 60;

async function sniffHead(signedUrl: string) {
  try {
    const res = await fetch(signedUrl, {
      headers: { Range: `bytes=0-${SNIFF_HEAD_BYTES - 1}` },
      cache: "no-store",
    });
    if (res.status !== 200 && res.status !== 206) return null; // can't read → fail closed
    const buf = new Uint8Array(await res.arrayBuffer());
    return sniffMagic(buf);
  } catch {
    return null; // network/parse failure → fail closed
  }
}

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

  const sniff = await sniffHead(data.signedUrl);
  if (!sniff || !sniff.ok) {
    return NextResponse.json(
      { error: "blocked-type", reason: sniff && !sniff.ok ? sniff.reason : "unreadable" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return NextResponse.json(
    { url: data.signedUrl, type: sniff.mime, kind: sniff.kind },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
