import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Download-my-data. Uses the caller's session (RLS-scoped), so every query
// returns only their own rows — profile, owned businesses, authored posts,
// messages they sent, their rsvps/itineraries, and their verification records.
// No other party's data is included (only messages the caller authored). No new
// storage; the JSON is streamed straight back as an attachment.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const uid = user.id;

  const [profile, businesses, posts, messages, rsvps, itineraries, verification] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("businesses").select("*").eq("owner_user_id", uid),
    supabase.from("posts").select("*").eq("author_id", uid),
    supabase.from("messages").select("*").eq("sender_id", uid),
    supabase.from("rsvps").select("*").eq("user_id", uid),
    supabase.from("itineraries").select("*").eq("user_id", uid),
    supabase.from("verification_records").select("*").eq("subject_id", uid),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    account: { id: uid, email: user.email ?? null, phone: user.phone ?? null },
    profile: profile.data ?? null,
    businesses: businesses.data ?? [],
    posts: posts.data ?? [],
    messages_sent: messages.data ?? [],
    rsvps: rsvps.data ?? [],
    itineraries: itineraries.data ?? [],
    verification_records: verification.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="bridgelink-my-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
