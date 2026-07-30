import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { stripLocale, withLocalePrefix, isPublicPath, isAdminPath, isSafeNextPath } from "@/lib/authRouting";

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
    // Return-to: remember the protected destination so the login page can send
    // them back (the locale-stripped path; the login page re-applies the locale).
    // `path` here is always a same-origin "/…", but isSafeNextPath is the
    // open-redirect guard that ALSO gates the login page's read of this
    // untrusted param. Drop any incoming query so /login only carries `next`.
    url.search = "";
    if (isSafeNextPath(path)) url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Admin gate: a signed-in non-admin must be turned away BEFORE any admin code
  // renders. The DB round-trip is scoped to /admin* only (never on other routes),
  // and it fails CLOSED — a missing admin_users row OR a query error leaves
  // adminRow null and redirects home. Reuses the admin_users_select_self RLS
  // policy (user_id = auth.uid()) exactly as the old in-page check did; the
  // /admin/layout.tsx server component mirrors this as a defense-in-depth layer.
  if (user && isAdminPath(path)) {
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!adminRow) {
      const url = request.nextUrl.clone();
      url.pathname = withLocalePrefix(locale, "/");
      return NextResponse.redirect(url);
    }
  }

  // Logged-out visitors at "/" get the marketing homepage, served in place via a
  // REWRITE so the URL stays "/" (the app's Feed also lives at "/" for logged-in
  // users — they fall through to it, unchanged). We repoint next-intl's OWN
  // response at "/<locale>/home" (by overriding its rewrite header) rather than
  // building a fresh NextResponse.rewrite: next-intl already injected the resolved
  // locale onto this response's request headers, and a new response would drop
  // that — making "/ne" render in English (the default fallback) instead of
  // Nepali. Reusing `response` also preserves any refreshed Supabase cookies.
  if (!user && path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/home`;
    response.headers.set("x-middleware-rewrite", url.toString());
    return response;
  }

  // Already signed in — keep them out of the auth screens.
  if (user && (path === "/login" || path === "/signup" || path === "/forgot-password")) {
    const url = request.nextUrl.clone();
    url.pathname = withLocalePrefix(locale, "/");
    return NextResponse.redirect(url);
  }

  return response;
}
