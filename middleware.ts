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
  // Skip static assets, the Next internals, and the OAuth callback — the
  // callback URL is registered with the auth provider verbatim and must
  // never gain a locale prefix or a redirect in front of it.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
