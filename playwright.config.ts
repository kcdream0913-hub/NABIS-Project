import { defineConfig, devices } from "@playwright/test";

// Dedicated E2E port. Deliberately NOT 3000: a stray dev server there (e.g. a
// WSL-hosted checkout) would be picked up by reuseExistingServer and the suite
// would silently test the wrong app. 3100 is E2E-owned, and reuseExistingServer
// is off outside local dev so CI always boots THIS build.
const PORT = 3100;
const HOST = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Generate the (gitignored) attachment fixtures before any test runs.
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
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
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-360", use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 640 } } },
  ],
});
