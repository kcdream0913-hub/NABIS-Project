import { expect, type Page } from "@playwright/test";

// Shared authenticated login for the E2E suites (account A). The login form is a
// client component with React-controlled inputs, so we wait for hydration
// (networkidle) before filling — filling on domcontentloaded can set the DOM value
// BEFORE onChange is attached, leaving React state empty (signInWithPassword then
// errors "missing email or phone"). toHaveValue confirms the field took the value.
export async function login(page: Page): Promise<void> {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) throw new Error("login() requires E2E_EMAIL / E2E_PASSWORD");

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const emailField = page.getByLabel(/email/i);
  const pwField = page.getByLabel(/password/i);
  await emailField.fill(email);
  await pwField.fill(password);
  await expect(emailField).toHaveValue(email);
  await expect(pwField).toHaveValue(password);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  // Login succeeds → navigates off /login (an error keeps us here and this throws).
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20_000 });
}
