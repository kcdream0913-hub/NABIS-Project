import { routing } from "@/i18n/routing";

export const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/pair",
  "/auth/callback",
  "/terms",
  "/privacy",
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
  return PUBLIC_PATHS.some((p) => path.startsWith(p));
}
