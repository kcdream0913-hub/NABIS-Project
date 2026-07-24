import { routing } from "@/i18n/routing";

export const PUBLIC_PATHS = ["/login", "/signup", "/auth/callback", "/terms", "/privacy"];

// "/ne/signup" -> { locale: "ne", path: "/signup" }; "/signup" -> { locale: "en", path: "/signup" }
export function stripLocale(pathname: string): { locale: string; path: string } {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue; // unprefixed, nothing to strip
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
