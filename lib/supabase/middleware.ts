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

  // Login is the front door for the app: unauthenticated visitors on a protected
  // route land there. Public marketing + auth routes (incl. "/") are exempt.
  if (!user && !isPublicPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = withLocalePrefix(locale, "/login");
    return NextResponse.redirect(url);
  }

  // Logged-out visitors at "/" get the marketing homepage, served in place via a
  // REWRITE so the URL stays "/" (the app's Feed also lives at "/" for logged-in
  // users — they fall through to it, unchanged). Internal target is always
  // locale-prefixed so the [locale] segment resolves.
  if (!user && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/home`;
    const rewrite = NextResponse.rewrite(url, { request: { headers: request.headers } });
    response.cookies.getAll().forEach((c) => rewrite.cookies.set(c));
    return rewrite;
  }

  // Already signed in — keep them out of the auth screens.
  if (user && (path === "/login" || path === "/signup" || path === "/forgot-password")) {
    const url = request.nextUrl.clone();
    url.pathname = withLocalePrefix(locale, "/");
    return NextResponse.redirect(url);
  }

  return response;
}
