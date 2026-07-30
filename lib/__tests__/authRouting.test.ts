import { describe, it, expect } from "vitest";
import { stripLocale, withLocalePrefix, isPublicPath, isAdminPath, isSafeNextPath } from "../authRouting";

// This is the exact logic that decides where an unauthenticated or
// already-logged-in user gets redirected, per locale. A bug here means
// people land on the wrong screen, or in a redirect loop, silently.
describe("stripLocale", () => {
  it("treats an unprefixed path as the default locale (en)", () => {
    expect(stripLocale("/signup")).toEqual({ locale: "en", path: "/signup" });
  });

  it("treats bare '/' as the default locale", () => {
    expect(stripLocale("/")).toEqual({ locale: "en", path: "/" });
  });

  it("strips the /ne prefix and recovers the underlying path", () => {
    expect(stripLocale("/ne/signup")).toEqual({ locale: "ne", path: "/signup" });
  });

  it("treats bare '/ne' as the ne-locale home path", () => {
    expect(stripLocale("/ne")).toEqual({ locale: "ne", path: "/" });
  });

  it("does not false-positive on a path that merely starts with 'ne' text", () => {
    // e.g. a hypothetical "/nepal-something" route must not be mistaken for /ne/...
    expect(stripLocale("/nepal-guide")).toEqual({ locale: "en", path: "/nepal-guide" });
  });

  it("strips /ne for nested paths", () => {
    expect(stripLocale("/ne/business/new")).toEqual({ locale: "ne", path: "/business/new" });
  });

  it("strips an explicit default-locale (/en) prefix too", () => {
    // Regression: "/en/terms" used to keep its /en prefix, so the public-path
    // check failed and logged-out visitors were bounced to /login.
    expect(stripLocale("/en/terms")).toEqual({ locale: "en", path: "/terms" });
    expect(stripLocale("/en")).toEqual({ locale: "en", path: "/" });
  });
});

describe("withLocalePrefix", () => {
  it("adds no prefix for the default locale", () => {
    expect(withLocalePrefix("en", "/signup")).toBe("/signup");
  });

  it("prefixes /ne for the ne locale", () => {
    expect(withLocalePrefix("ne", "/signup")).toBe("/ne/signup");
  });

  it("does not produce a trailing-slash-only artifact for ne + root", () => {
    // Regression guard: an earlier draft produced "/ne/" here instead of "/ne".
    expect(withLocalePrefix("ne", "/")).toBe("/ne");
  });

  it("round-trips with stripLocale for every locale", () => {
    for (const [locale, path] of [
      ["en", "/members"],
      ["ne", "/members"],
      ["en", "/"],
      ["ne", "/"],
    ] as const) {
      const prefixed = withLocalePrefix(locale, path);
      expect(stripLocale(prefixed)).toEqual({ locale, path });
    }
  });
});

describe("isPublicPath", () => {
  it("treats /login, /signup, /forgot-password, /pair, /auth/callback as public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/signup")).toBe(true);
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/pair")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("treats the public legal pages as public", () => {
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
  });

  it("treats app routes as non-public", () => {
    expect(isPublicPath("/members")).toBe(false);
    expect(isPublicPath("/profile")).toBe(false);
    // /settings/privacy must NOT be caught by the /privacy public prefix
    expect(isPublicPath("/settings/privacy")).toBe(false);
  });

  it("treats '/' and the marketing routes as public (homepage renders at '/')", () => {
    // "/" is public as an EXACT match — the marketing homepage renders there for
    // logged-out visitors; a prefix check would wrongly make everything public.
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/home")).toBe(true);
    expect(isPublicPath("/welcome-tour")).toBe(true);
    expect(isPublicPath("/guidelines")).toBe(true);
    expect(isPublicPath("/guidelines#data")).toBe(true);
    // but not an arbitrary deep path
    expect(isPublicPath("/members")).toBe(false);
  });
});

// The middleware gates /admin* on an admin_users row. isAdminPath decides which
// requests trigger that DB check — it must catch /admin and every sub-route, and
// must NOT catch a lookalike like /administrators. It runs on the locale-stripped
// path, so callers pass stripLocale(pathname).path.
describe("isAdminPath", () => {
  it("matches the admin root and its sub-routes", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/")).toBe(true);
    expect(isAdminPath("/admin/reports")).toBe(true);
    expect(isAdminPath("/admin/businesses/123")).toBe(true);
  });

  it("does not match unrelated or lookalike paths", () => {
    expect(isAdminPath("/")).toBe(false);
    expect(isAdminPath("/members")).toBe(false);
    // must not prefix-false-positive on a route that merely starts with 'admin'
    expect(isAdminPath("/administrators")).toBe(false);
    expect(isAdminPath("/admins")).toBe(false);
  });

  it("resolves under both locales via the middleware pipeline", () => {
    // The middleware feeds stripLocale(pathname).path into isAdminPath.
    expect(isAdminPath(stripLocale("/admin").path)).toBe(true);
    expect(isAdminPath(stripLocale("/ne/admin").path)).toBe(true);
    expect(isAdminPath(stripLocale("/ne/admin/reports").path)).toBe(true);
  });

  it("admin paths are protected, never public (logged-out => /login upstream)", () => {
    // /admin is NOT public, so the !user && !isPublicPath branch still redirects a
    // logged-out visitor to /login before the admin check ever runs.
    expect(isPublicPath("/admin")).toBe(false);
  });
});

// D-072 return-to guard. The middleware writes ?next=<protected path> on the
// logged-out redirect and the login page reads it back from an UNTRUSTED query
// string, so this must accept same-origin paths and REJECT anything that could
// send the user off-site after login (open redirect).
describe("isSafeNextPath", () => {
  it("accepts same-origin absolute paths", () => {
    expect(isSafeNextPath("/admin")).toBe(true);
    expect(isSafeNextPath("/admin/reports")).toBe(true);
    expect(isSafeNextPath("/members")).toBe(true);
    expect(isSafeNextPath("/ne/admin")).toBe(true); // a locale-prefixed path is still same-origin
  });

  it("rejects off-site and malformed targets (open-redirect guard)", () => {
    expect(isSafeNextPath("//evil.com")).toBe(false); // protocol-relative
    expect(isSafeNextPath("/\\evil.com")).toBe(false); // backslash trick some browsers treat as //
    expect(isSafeNextPath("https://evil.com")).toBe(false); // absolute URL
    expect(isSafeNextPath("http://evil.com")).toBe(false);
    expect(isSafeNextPath("evil.com")).toBe(false); // no leading slash
    expect(isSafeNextPath("admin")).toBe(false);
  });

  it("rejects empty / missing values (login falls back to '/')", () => {
    expect(isSafeNextPath(null)).toBe(false);
    expect(isSafeNextPath(undefined)).toBe(false);
    expect(isSafeNextPath("")).toBe(false);
  });
});

// The middleware pipes the request pathname through stripLocale then isPublicPath.
// Terms + privacy must be reachable logged-out in BOTH locales (and via an explicit
// /en prefix), because signup links to them for consent.
describe("legal pages are public in every locale (middleware pipeline)", () => {
  const publicInMiddleware = (pathname: string) => isPublicPath(stripLocale(pathname).path);
  for (const p of ["/terms", "/en/terms", "/ne/terms", "/privacy", "/en/privacy", "/ne/privacy"]) {
    it(`${p} is public`, () => expect(publicInMiddleware(p)).toBe(true));
  }
});
