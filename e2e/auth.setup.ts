import { test as setup } from "@playwright/test";
import { login } from "./_login";

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
// The saved-session path. Kept in sync by convention with the literal in social.spec.ts
// + feed-media.spec.ts (a test file can't be imported by another test file, so it is not
// shared via import). Gitignored (e2e/.auth/).
const authFile = "e2e/.auth/user.json";

// ONE authenticated session for the whole run. The authed specs (social.spec.ts +
// feed-media.spec.ts) opt into this via test.use({ storageState: authFile }) and no
// longer call login() per test. Those per-test logins turned on ~13 concurrent GoTrue
// sign-ins as the single seeded account A the FIRST time this branch's ffmpeg fixtures
// activated those suites — the source of the observed _login.ts waitForURL stall. A
// Playwright "setup" project dependency runs this exactly ONCE, shared across both
// viewport projects (storageState is cookies/origin-storage, not viewport-scoped).
setup("authenticate account A once for the whole run", async ({ page }) => {
  setup.skip(!EMAIL || !PASSWORD, "set E2E_EMAIL / E2E_PASSWORD to run the authed suites");
  await login(page);
  await page.context().storageState({ path: authFile });
  // Single log line so the "one login, not ~13" claim is verifiable by counting, not
  // assumed (this is the ONLY caller of the shared _login.ts login() now).
  // eslint-disable-next-line no-console
  console.log(`[auth.setup] account A authenticated ONCE; storageState -> ${authFile}`);
});
