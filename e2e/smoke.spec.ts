import { test, expect } from "@playwright/test";

// UNAUTHENTICATED smoke tests only. There is no seeded test account, so
// anything requiring login (feed, directory, messages, etc.) is out of scope
// here on purpose — do not extend this file to log in with real or fake
// credentials against the live Supabase project without a dedicated test
// account and environment first.
//
// NOTE: written but not executed by Claude in this sandbox — browser binary
// download is blocked by the network egress allowlist. Run
// `npx playwright install && npx playwright test` locally/in CI before
// trusting these.

test("unauthenticated visitor to / is redirected to /signup", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/signup$/);
});

test("signup page renders its core content in English", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByText("Join BridgeLink")).toBeVisible();
  await expect(page.getByText("Continue with Google")).toBeVisible();
});

test("Nepali signup page renders translated content, not English fallback", async ({ page }) => {
  await page.goto("/ne/signup");
  // This is the exact failure mode from earlier today (NextIntlClientProvider
  // missing / stale merged folder): the page would 500, or silently render
  // English. Assert the actual Devanagari string is present.
  await expect(page.getByText("BridgeLink मा सामेल हुनुहोस्")).toBeVisible();
});

test("login page renders and links back to signup", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Welcome back")).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
});

test("view toggle and language toggle are both visible on mobile width (alignment regression guard)", async ({ page }) => {
  // Regression guard for the bug fixed earlier this session: GlobalSearch's
  // ml-auto lived on an element that's `hidden` below the sm breakpoint,
  // which collapsed the whole right-hand cluster (search/language/bell) back
  // to the left with nothing pinning it to the right edge. AppShell wraps
  // every route unconditionally, including signup, so this is a real check.
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/signup");
  await expect(page.getByRole("tablist", { name: "Country view" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Language" })).toBeVisible();
});
