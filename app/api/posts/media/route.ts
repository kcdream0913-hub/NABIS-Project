import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// BL-SOCIAL-02 §4.4 — batched signed-URL minting for private post media.
// One createSignedUrls() call per page of posts (not one per item). URLs are
// minted with the CALLER'S session, so Storage enforces post_media_read RLS.
// TTL 1 hour per spec. The bucket is private — there is no public URL path.
export const runtime = "nodejs";

const BUCKET = "post-media";
const TTL_SECONDS = 60 * 60; // 1 hour
const MAX_PATHS = 200; // a page of posts * (4 media + poster) stays well under this

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const paths = (body as { paths?: unknown })?.paths;
  if (!Array.isArray(paths) || paths.some((p) => typeof p !== "string")) {
    return NextResponse.json({ error: "paths must be a string[]" }, { status: 400 });
  }
  const clean = Array.from(new Set(paths as string[]))
    .filter((p) => p && !p.includes(".."))
    .slice(0, MAX_PATHS);

  const urls: Record<string, string> = {};
  if (clean.length === 0) {
    return NextResponse.json({ urls }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(clean, TTL_SECONDS);
  if (error) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  for (const row of data ?? []) {
    if (row.signedUrl && row.path) urls[row.path] = row.signedUrl;
  }
  return NextResponse.json({ urls }, { headers: { "Cache-Control": "private, no-store" } });
}
