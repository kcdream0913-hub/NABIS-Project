import { describe, it, expect } from "vitest";
import { stripLocale, withLocalePrefix, isPublicPath } from "../authRouting";

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
  it("treats /login, /signup, /auth/callback as public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/signup")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
  });

  it("treats the public legal pages as public", () => {
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
  });

  it("treats the home feed and other app routes as non-public", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/members")).toBe(false);
    expect(isPublicPath("/profile")).toBe(false);
    // /settings/privacy must NOT be caught by the /privacy public prefix
    expect(isPublicPath("/settings/privacy")).toBe(false);
  });
});
