import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // A password-recovery link exchanges a code for a session exactly like
      // any other flow, but the user clicked it to SET A NEW PASSWORD, not to
      // log in. Without this branch they landed on `next` (default "/") fully
      // signed in, with their forgotten password still the only one on file —
      // the reset accomplished nothing. Supabase's resetPasswordForEmail sends
      // type=recovery on this redirect; route that case to update-password
      // instead of wherever `next` points.
      const destination = type === "recovery" ? "/update-password" : next;
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
