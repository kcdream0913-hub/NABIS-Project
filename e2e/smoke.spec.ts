import { test, expect, type Page } from "@playwright/test";

// UNAUTHENTICATED marketing smoke tests. These run against a PRODUCTION build
// (see playwright.config.ts — it builds and `next start`s the app), so they catch
// render/hydration failures that only surface in the built app, not `next dev`.
//
// Scope is deliberately logged-out only: there is no seeded CI test account, so
// anything behind auth (feed, directory, messages) is out of scope here. Do NOT
// add a login flow against the live Supabase project without a dedicated test
// account + environment first.

// Collects uncaught client exceptions so a route that throws on load/hydration
// fails loudly here, instead of silently rendering a blank/degraded page (the
// exact failure mode of the "side menu blanks the app" production bug).
function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

const MARKETING_ROUTES = [
  { url: "/", name: "homepage (en, served at / via rewrite)" },
  { url: "/ne", name: "homepage (ne)" },
  { url: "/welcome-tour", name: "welcome tour" },
  { url: "/guidelines", name: "community guidelines" },
];

for (const route of MARKETING_ROUTES) {
  test(`${route.name} renders without a page error`, async ({ page }) => {
    const errors = trackPageErrors(page);
    const res = await page.goto(route.url, { waitUntil: "domcontentloaded" });

    // 1. Server returned success — not 404 / 500.
    expect(res, `no response for ${route.url}`).not.toBeNull();
    expect(res!.status(), `status for ${route.url}`).toBeLessThan(400);

    // 2. Stayed on the intended URL — was NOT bounced to /login (the auth gate).
    //    A regression that made a marketing route non-public would trip this.
    expect(page.url(), `should not redirect ${route.url} to login`).not.toContain("/login");

    // 3. The BridgeLink brand renders on every marketing page (nav / topbar).
    await expect(page.getByText("BridgeLink").first()).toBeVisible();

    // 4. A primary heading rendered (page has real content, not an error shell).
    await expect(page.locator("h1").first()).toBeVisible();

    // 5. No uncaught client exception during load + hydration. Checked last so the
    //    awaits above have given hydration time to run.
    expect(errors, `page errors on ${route.url}: ${errors.join(" | ")}`).toEqual([]);
  });
}

test("Nepali homepage renders a single-line Devanagari hero (not English, not word-split)", async ({ page }) => {
  await page.goto("/ne", { waitUntil: "domcontentloaded" });
  const hero = page.locator("h1").first();
  // Devanagari present — proves the Nepali dictionary rendered, not the English
  // fallback.
  await expect(hero).toContainText(/[ऀ-ॿ]/);
  // Exactly one direct child span: the Nepali hero must never be split into the
  // per-word animated spans the English hero uses (Task A regression guard).
  await expect(hero.locator("> span")).toHaveCount(1);
});

test("guidelines exposes the #data anchor its footer 'Data & documents' link targets", async ({ page }) => {
  await page.goto("/guidelines", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#data")).toHaveCount(1);
});
