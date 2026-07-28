import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ATTACHMENT_BUCKET } from "@/lib/attachments";
import { sniffMagic, needsFullHead, SNIFF_HEAD_BYTES, SNIFF_PROBE_BYTES } from "@/lib/attachmentSniff";

// Server-side signed-URL minting for private message attachments. The signed URL is
// generated with the CALLER'S session, so Supabase Storage enforces the
// message_attach_select RLS policy (thread participants only) — a non-participant
// gets a 403 here, never a URL. Short TTL so a leaked link expires quickly.
//
// D-052 — MAGIC-BYTE GATE: before returning the URL we fetch the head bytes of the
// object and sniff its true type. If the bytes are not an allowlisted type (e.g. an
// .exe renamed "invoice.pdf", or any archive/executable), we return 403 and NEVER
// hand back a URL. Fails CLOSED: if the head can't be read/verified, no URL.
//
// SCOPE OF THE GUARANTEE (not "unskippable" in the absolute sense): this route is the
// only GATED mint path, and the app UI always routes through it, so a message row
// inserted by a malicious client referencing an unscanned .exe is never DELIVERED.
// BUT storage RLS (message_attach_select) grants SELECT to any thread participant, so
// a participant CAN call createSignedUrl directly and bypass this sniff. That is
// low-risk today (only the victim's own client would do so, against a file already in
// their thread). The load-bearing rule: ANY new signed-URL path — share link,
// notification email, admin tool — MUST route through this sniff, because storage RLS
// alone does not gate on type.
export const runtime = "nodejs";

const TTL_SECONDS = 60;

async function rangeBytes(signedUrl: string, n: number): Promise<Uint8Array | null> {
  const res = await fetch(signedUrl, {
    headers: { Range: `bytes=0-${n - 1}` },
    cache: "no-store",
  });
  if (res.status !== 200 && res.status !== 206) return null; // can't read → fail closed
  return new Uint8Array(await res.arrayBuffer());
}

async function sniffHead(signedUrl: string) {
  try {
    // Two-stage (P2e): a 512-byte probe classifies every binary signature + reject.
    // Only ZIP/OOXML (part names may sit past 512B) and text (validate a larger
    // sample) need the full 64KB window — refetch ONLY then. Keeps egress at ~512B
    // per attachment for the common image/pdf/video case instead of 64KB.
    const probe = await rangeBytes(signedUrl, SNIFF_PROBE_BYTES);
    if (!probe) return null; // fail closed
    if (!needsFullHead(probe)) return sniffMagic(probe);
    const full = await rangeBytes(signedUrl, SNIFF_HEAD_BYTES);
    if (!full) return null; // fail closed
    return sniffMagic(full);
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
