import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";
import { legacyHostRedirect } from "@/lib/authRouting";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // Retire the old Vercel production alias BEFORE any locale/auth handling: a
  // request on nabis-project.vercel.app is 308'd to the canonical origin so a
  // stale bookmark or link never starts a session on a non-brand host. Vercel
  // Deployment Protection structurally can't do this (Standard Protection excludes
  // production URLs; the only scope that would cover it also walls
  // www.sangamline.com). See D-089 / legacyHostRedirect. The matcher already
  // excludes /auth/callback, so an in-flight OAuth code exchange is never
  // redirected mid-swap.
  const legacyTarget = legacyHostRedirect(
    request.headers.get("host"),
    request.nextUrl.pathname,
    request.nextUrl.search
  );
  if (legacyTarget) return NextResponse.redirect(legacyTarget, 308);

  // next-intl first: resolves/rewrites the locale segment so "/members" and
  // "/ne/members" both reach app/[locale]/members. Its response (including
  // the internal rewrite) is then reused, not replaced, by the auth check.
  const response = intlMiddleware(request);
  return updateSession(request, response);
}

export const config = {
  // Skip static assets, the Next internals, the OAuth callback, and API routes.
  // The callback URL is registered with the auth provider verbatim and must
  // never gain a locale prefix or a redirect in front of it. API routes
  // (/api/*) handle their OWN auth and are not locale-scoped — running the
  // intl+auth middleware on them would rewrite the path to a locale segment
  // (breaking the route → 404) and redirect unauthenticated calls to /login
  // (307) instead of letting the route return a JSON 401.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
