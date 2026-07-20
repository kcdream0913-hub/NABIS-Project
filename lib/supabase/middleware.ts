import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { stripLocale, withLocalePrefix, isPublicPath } from "@/lib/authRouting";

export async function updateSession(request: NextRequest, response: NextResponse) {
  // Reuse the response next-intl already produced (it carries the locale
  // rewrite) — only layer Supabase's cookies onto it, never replace it.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth token if expired. Required for Server Components,
  // which cannot write cookies themselves.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { locale, path } = stripLocale(request.nextUrl.pathname);

  // Signup is the front door: unauthenticated visitors land there first,
  // never on the app itself. Redirect keeps whatever locale they were on.
  if (!user && !isPublicPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = withLocalePrefix(locale, "/signup");
    return NextResponse.redirect(url);
  }

  // Already signed in — keep them out of the signup/login screens.
  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = withLocalePrefix(locale, "/");
    return NextResponse.redirect(url);
  }

  return response;
}
