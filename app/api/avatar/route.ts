import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sniffMagic } from "@/lib/attachmentSniff";
import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  avatarObjectPath,
  avatarPathFromPublicUrl,
  avatarSniffAccepted,
} from "@/lib/avatar";

// Avatar / business-logo upload. PUBLIC bucket (BL-AVATAR-01), so there is no signed-URL READ
// route to sniff on — the D-052 magic-byte gate therefore runs HERE, on WRITE. The upload uses
// the CALLER'S session, so the avatars storage RLS (owner-prefix, business-owner) is the real
// enforcement; the explicit checks below give a clean error instead of an opaque 403 and decide
// the path. The user id ALWAYS comes from the session — never the client — so nobody can write
// into another user's prefix; a business logo requires OWNING the business (not membership).
export const runtime = "nodejs";

function targetColumns(kind: "user" | "business") {
  return kind === "user"
    ? { table: "profiles", col: "avatar_url" }
    : { table: "businesses", col: "logo_url" };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const kind = form.get("kind");
  const businessId = (form.get("businessId") as string | null) || null;

  if (!(file instanceof Blob)) return NextResponse.json({ error: "no-file" }, { status: 400 });
  if (kind !== "user" && kind !== "business") return NextResponse.json({ error: "bad-kind" }, { status: 400 });

  // Authorize + resolve the owner path segment (never trust a client-supplied user id).
  let ownerSeg: string;
  if (kind === "user") {
    ownerSeg = user.id;
  } else {
    if (!businessId) return NextResponse.json({ error: "missing-business" }, { status: 400 });
    const { data: biz } = await supabase.from("businesses").select("owner_user_id").eq("id", businessId).maybeSingle();
    if (!biz || (biz as { owner_user_id: string }).owner_user_id !== user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    ownerSeg = businessId;
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.byteLength === 0) return NextResponse.json({ error: "empty" }, { status: 400 });
  if (buf.byteLength > AVATAR_MAX_BYTES) return NextResponse.json({ error: "too-large" }, { status: 413 });

  // D-052: the type is decided by MAGIC BYTES, never the client Content-Type / extension.
  const sniff = sniffMagic(buf);
  if (!avatarSniffAccepted(sniff)) {
    return NextResponse.json({ error: "unsupported-type" }, { status: 415 });
  }
  const mime = (sniff as { mime: string }).mime; // sniff.ok is guaranteed by avatarSniffAccepted

  const path = avatarObjectPath(kind, ownerSeg, crypto.randomUUID(), mime);

  // Upload with the SNIFFED content-type (never the claim). upsert:false → unique uuid key.
  const { error: upErr } = await supabase.storage.from(AVATAR_BUCKET).upload(path, buf, {
    contentType: mime,
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: "upload-failed" }, { status: 500 });

  const publicUrl = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;

  const { table, col } = targetColumns(kind);
  const rowId = kind === "user" ? user.id : (businessId as string);

  // Read the previous object (delete-on-replace) BEFORE overwriting the column.
  const { data: current } = await supabase.from(table).select(col).eq("id", rowId).maybeSingle();
  const oldUrl = (current as Record<string, string | null> | null)?.[col] ?? null;

  const { error: colErr } = await supabase.from(table).update({ [col]: publicUrl }).eq("id", rowId);
  if (colErr) {
    // Don't orphan the object we just uploaded if the column write fails.
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return NextResponse.json({ error: "save-failed" }, { status: 500 });
  }

  // Best-effort: remove the previous object, only if it was one of OURS (never a foreign URL).
  const oldPath = avatarPathFromPublicUrl(oldUrl);
  if (oldPath && oldPath !== path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
  }

  return NextResponse.json({ url: publicUrl });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { kind?: string; businessId?: string | null } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body → falls through to bad-kind */
  }
  const kind = body.kind;
  const businessId = body.businessId ?? null;
  if (kind !== "user" && kind !== "business") return NextResponse.json({ error: "bad-kind" }, { status: 400 });

  if (kind === "business") {
    if (!businessId) return NextResponse.json({ error: "missing-business" }, { status: 400 });
    const { data: biz } = await supabase.from("businesses").select("owner_user_id").eq("id", businessId).maybeSingle();
    if (!biz || (biz as { owner_user_id: string }).owner_user_id !== user.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { table, col } = targetColumns(kind);
  const rowId = kind === "user" ? user.id : (businessId as string);

  const { data: current } = await supabase.from(table).select(col).eq("id", rowId).maybeSingle();
  const oldUrl = (current as Record<string, string | null> | null)?.[col] ?? null;

  const { error: colErr } = await supabase.from(table).update({ [col]: null }).eq("id", rowId);
  if (colErr) return NextResponse.json({ error: "clear-failed" }, { status: 500 });

  const oldPath = avatarPathFromPublicUrl(oldUrl);
  if (oldPath) await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);

  return NextResponse.json({ ok: true });
}
