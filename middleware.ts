import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
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
