import { defineConfig, devices } from "@playwright/test";

// Dedicated E2E port. Deliberately NOT 3000: a stray dev server there (e.g. a
// WSL-hosted checkout) would be picked up by reuseExistingServer and the suite
// would silently test the wrong app. 3100 is E2E-owned, and reuseExistingServer
// is off outside local dev so CI always boots THIS build.
const PORT = 3100;
const HOST = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Generate the (gitignored) attachment fixtures before any test runs, and load
  // .env.local (non-overriding) so global-teardown can reach Supabase locally.
  globalSetup: "./e2e/global-setup.ts",
  // Clean up prod residue this run wrote (the suite runs against the LIVE Supabase
  // project — D-060). Deletes A's attachment objects + tombstones its messages in
  // the E2E thread. Fails loudly if cleanup errors.
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  // NO retries. A blanket retry (previously `CI ? 2 : 0`) let the FIRST real defect
  // this harness found — an intermittent React #418 hydration mismatch on the
  // marketing homepage — pass on a re-attempt, and gave every other test three
  // chances too (a silent-failure switch on a gate — D-059). The #418 case is
  // quarantined explicitly, by name, on its single assertion in smoke.spec.ts;
  // everything else fails on the first miss.
  retries: 0,
  webServer: {
    // Run the smoke suite against a PRODUCTION build - the same artifact Vercel
    // serves - not `next dev`. This is what catches build-only / hydration
    // failures (the class of bug that has bitten this repo). Self-contained so it
    // works identically in CI and locally: build, then start.
    command: `npm run build && npx next start --port ${PORT}`,
    // Readiness probe: a public marketing route that returns 200 for logged-out
    // visitors and doesn't depend on an auth cookie.
    url: `${HOST}/guidelines`,
    reuseExistingServer: !process.env.CI,
    // Generous: a cold `next build` (~1 min) plus start must fit inside this.
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  use: {
    baseURL: HOST,
  },
  // Every spec runs at BOTH a desktop width and 360x640 (BL-MSG-05 requires the
  // attachment sheet to work as a bottom sheet <768px and a popover >=768px, and the
  // action bar to stay usable at the narrow width).
  projects: [
    // Authenticate account A ONCE (e2e/auth.setup.ts) and save its storageState; the
    // authed specs depend on this and reuse the session instead of each calling login()
    // — which turned on ~13 concurrent GoTrue sign-ins the first time this branch's
    // ffmpeg fixtures activated those suites. A dependency runs ONCE total, shared
    // across both viewport projects (storageState is cookies, not viewport-scoped).
    // NOTE: storageState is NOT set at project level on purpose — that would force
    // smoke.spec.ts + attachments.spec.ts into a pre-authenticated context and break
    // their own login/logout assertions; it is scoped to the two files that need it.
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
    { name: "chromium-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 640 } }, dependencies: ["setup"] },
  ],
});
