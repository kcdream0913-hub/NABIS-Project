import { defineConfig, devices } from "@playwright/test";

// Dedicated E2E port. Deliberately NOT 3000: a stray dev server there (e.g. a
// WSL-hosted checkout) would be picked up by reuseExistingServer and the suite
// would silently test the wrong app. 3100 is E2E-owned, and reuseExistingServer
// is off outside local dev so CI always boots THIS build.
const PORT = 3100;
const HOST = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `${HOST}/signup`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  use: {
    baseURL: HOST,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
