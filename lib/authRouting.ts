import { routing } from "@/i18n/routing";

export const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/pair",
  "/auth/callback",
  "/terms",
  "/privacy",
  // Public marketing routes (the homepage is served at "/" via a rewrite; see
  // isPublicPath's exact "/" case and updateSession).
  "/home",
  "/welcome-tour",
  "/guidelines",
];

// "/ne/signup" -> { locale: "ne", path: "/signup" }; "/signup" -> { locale: "en", path: "/signup" }.
// The default locale (en) is normally unprefixed, but an explicit "/en/terms" can
// still arrive (direct hit, a stray link). We strip that prefix too, so the public
// -path check sees "/terms" — otherwise "/en/terms" was treated as protected and a
// logged-out visitor got bounced to /login (the legal pages signup links to).
export function stripLocale(pathname: string): { locale: string; path: string } {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return { locale, path: pathname.slice(`/${locale}`.length) || "/" };
    }
  }
  return { locale: routing.defaultLocale, path: pathname };
}

export function withLocalePrefix(locale: string, path: string): string {
  if (locale === routing.defaultLocale) return path;
  return `/${locale}${path === "/" ? "" : path}`;
}

export function isPublicPath(path: string): boolean {
  // "/" is public (the marketing homepage renders there for logged-out visitors),
  // but as an EXACT match — a prefix check would make every path public.
  if (path === "/") return true;
  return PUBLIC_PATHS.some((p) => path.startsWith(p));
}

// The admin area (and any future /admin/* sub-route). Kept locale-stripped —
// callers pass the path from stripLocale, so "/admin" and "/ne/admin" both
// resolve to "/admin" here. Used by the middleware to gate admin access before
// any admin code runs.
export function isAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

// A "next" / return-to path is safe to redirect to only if it's a SAME-ORIGIN
// absolute path: it must start with a single "/". This rejects protocol-relative
// ("//evil.com") and backslash-tricked ("/\evil.com") values that browsers can
// treat as off-site, and absolute URLs ("https://evil.com") — an open-redirect
// guard. The middleware writes this param from the (already same-origin) request
// path; the login page reads it back from an UNTRUSTED query string, so both
// sides gate on this. It is a type guard so callers narrow `string | null`.
export function isSafeNextPath(next: string | null | undefined): next is string {
  return (
    typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  );
}

// D-075. The password-login path carries `?next=` through as a literal query
// param the login page reads back after signInWithPassword resolves (see
// handleLogin). The Google OAuth path had no equivalent: signInWithOAuth's
// `redirectTo` was a bare "/auth/callback" with no `next`, so
// /auth/callback/route.ts always fell back to its own default ("/") — a
// logged-out visitor bounced to /login?next=/admin/reports who then clicked
// "Continue with Google" landed on the home feed instead of back on the report
// they wanted. This builds that same `next` onto the OAuth redirect URL so it
// survives the round trip: Supabase appends its own `code` (and `type`, for a
// recovery link) onto `redirectTo` verbatim, so anything set here arrives back
// at the callback route untouched, which already reads `searchParams.get("next")`.
// `next` is untrusted (read from the login page's own query string) — gated by
// the SAME isSafeNextPath guard as the password path, for the same
// open-redirect reason; an unsafe value is silently dropped rather than passed
// through, so the callback route's own "/" default takes over.
export function buildOAuthRedirectUrl(origin: string, next: string | null | undefined): string {
  const url = new URL("/auth/callback", origin);
  if (isSafeNextPath(next)) url.searchParams.set("next", next);
  return url.toString();
}

// D-089. `nabis-project.vercel.app` is the project's CLEAN Vercel production
// alias. Vercel Deployment Protection cannot retire it: Standard Protection
// (`all_except_custom_domains`) EXCLUDES production URLs, so this alias serves the
// real app to anonymous clients (verified live — 307 to /login, no auth wall),
// and the only scope that WOULD cover it (All Deployments) also walls the custom
// domain www.sangamline.com — not an option. So the alias is retired in code: any
// request arriving on it is 308'd (permanent, method-preserving) to the canonical
// origin, so an old bookmark or stale link never starts a session on a non-brand
// host. www is canonical — the apex sangamline.com 308s to www at the Vercel edge
// (verified) and www is the only origin Supabase Auth redirects to — so targeting
// www lands in ONE hop.
//
// EXACT host match only, and it MUST stay exact: the account-scoped alias
// (nabis-project-<hash>-<team>.vercel.app) is already walled by Standard
// Protection (verified — 302 to vercel.com/sso-api), and preview/git aliases
// (nabis-project-git-*.vercel.app) must keep working, so a prefix/substring match
// would break them. The canonical host can never equal LEGACY_HOST, so this can
// never loop — the failure mode a canonical-host redirect must avoid. Returns the
// canonical-origin URL to redirect to, or null to pass through.
export const LEGACY_HOST = "nabis-project.vercel.app";
export const CANONICAL_ORIGIN = "https://www.sangamline.com";

export function legacyHostRedirect(
  host: string | null,
  pathname: string,
  search: string
): string | null {
  if (host !== LEGACY_HOST) return null;
  return new URL(pathname + search, CANONICAL_ORIGIN).toString();
}
