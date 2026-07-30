import { test, expect } from "@playwright/test";

// D-067 — /admin access hardening. The admin area is gated in middleware (a
// signed-in non-admin, and a logged-out visitor, are redirected BEFORE any admin
// code runs), with admin/layout.tsx as a fail-closed second layer. These checks
// assert the turn-away happens at the HTTP layer — a 307 whose body never
// contains admin content — for the two rejection cases, and that the two land on
// DISTINCT targets (so the non-admin branch is proven to fire, not just the
// logged-out one):
//   * logged-out visitor   -> /login   (unchanged; also proves /admin stays protected)
//   * signed-in NON-admin   -> / (home) (the new behavior; NOT /login, NOT the dashboard)
// The admin-reaches-dashboard path is a structural no-op for admins (the layout +
// middleware run the SAME admin_users_select_self check the old in-page guard used,
// and simply fall through when the row exists) and needs an admin account the E2E
// seed doesn't provide, so it is not asserted here.
//
// Both requests are read-only GETs — this spec writes nothing to prod.

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
// Kept in sync by convention with e2e/auth.setup.ts (a test file can't import another
// test file). Account A is a seeded NON-admin, so its session is the non-admin subject.
const authFile = "e2e/.auth/user.json";

const ADMIN_CONTENT = /review queue|approve|reject|dismiss|pending verification/i;
const ADMIN_PATHS = ["/admin", "/admin/reports"] as const;

test.describe("admin gate — logged-out visitor is turned away to /login", () => {
  for (const p of ADMIN_PATHS) {
    test(`GET ${p} (no session) -> 307 /login?next=${p}, no admin body`, async ({ request }) => {
      const res = await request.get(p, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      const loc = res.headers()["location"] ?? "";
      expect(loc).toContain("/login");
      // D-072: the return-to destination is preserved so login can send them back
      // (the base is a dummy — we only read the query, and it handles a relative
      // or absolute Location; %2Fadmin decodes back to the requested path).
      expect(new URL(loc, "http://localhost").searchParams.get("next")).toBe(p);
      expect(await res.text()).not.toMatch(ADMIN_CONTENT);
    });
  }
});

test.describe("admin gate — signed-in non-admin is turned away to home", () => {
  test.use({ storageState: authFile });
  test.skip(!EMAIL || !PASSWORD, "set E2E_EMAIL / E2E_PASSWORD (seeded non-admin account A) to run");

  for (const p of ADMIN_PATHS) {
    test(`GET ${p} (non-admin session) -> 307 home, not /login, no admin body`, async ({ request }) => {
      const res = await request.get(p, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      const loc = res.headers()["location"] ?? "";
      // The redirect resolved a REAL user (else it would go to /login like logged-out)
      // and sent them OUT of the admin area — this is the non-admin branch, not the
      // logged-out branch.
      expect(loc).not.toContain("/login");
      expect(loc).not.toContain("/admin");
      expect(await res.text()).not.toMatch(ADMIN_CONTENT);
    });
  }
});
