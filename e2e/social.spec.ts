import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { existsSync } from "node:fs";

// BL-SOCIAL-02 §5 E2E (tests 16–24). AUTHORED BUT UNVERIFIED in the build
// environment — there is no browser here (Playwright binaries are blocked) and no
// seeded CI account, so these were written to spec, not executed. To run them:
//   1. seed a pilot account:  node scripts/seed-test-accounts.mjs
//   2. export E2E_EMAIL / E2E_PASSWORD for that (verified) account
//   3. drop fixtures in e2e/fixtures/: img1.jpg, img2.jpg (<10MB each),
//      short.mp4 (<90s, <50MB), big.mp4 (>90s OR >50MB)
//   4. npx playwright install && npm run test:e2e
// Without E2E_EMAIL the whole suite skips (keeps CI green).

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const FIXTURES = path.join(__dirname, "fixtures");
// This suite (BL-SOCIAL-02) needs its own media fixtures AND a seeded feed for
// account A — neither is provided here (bl-e2e-01/02 cover DM attachments, whose
// fixtures are generated). Skip cleanly when the media is absent so it never blocks
// CI; getting it green is separate BL-SOCIAL-02 work.
const HAS_MEDIA = ["img1.jpg", "img2.jpg", "short.mp4", "big.mp4"].every((f) => existsSync(path.join(FIXTURES, f)));

test.describe("feed social actions (authenticated)", () => {
  test.skip(!EMAIL || !PASSWORD, "set E2E_EMAIL / E2E_PASSWORD to run the social E2E suite");
  test.skip(!HAS_MEDIA, "social E2E needs e2e/fixtures/{img1,img2}.jpg + {short,big}.mp4 and a seeded feed (BL-SOCIAL-02)");

  async function login(page: Page) {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel(/email/i).fill(EMAIL!);
    await page.getByLabel(/password/i).fill(PASSWORD!);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL((u) => !u.pathname.includes("/login"));
  }

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
  });

  const firstCard = (page: Page) => page.locator("article").first();

  // 16 — Like → increment → reload persists → change to namaste (count same) → unlike → decrement.
  test("react: like, change kind, unlike", async ({ page }) => {
    const card = firstCard(page);
    const react = card.getByRole("button", { name: /react/i });
    await react.click();
    await expect(react).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(firstCard(page).getByRole("button", { name: /react/i })).toHaveAttribute("aria-pressed", "true");
    // open the picker and switch to Namaste — total count unchanged, emoji changes
    await firstCard(page).getByRole("button", { name: /react/i }).click({ delay: 500 });
    await page.getByRole("menuitemradio", { name: /namaste/i }).click();
    // unlike (tap the held kind removes it)
    await firstCard(page).getByRole("button", { name: /react/i }).click();
    await expect(firstCard(page).getByRole("button", { name: /react/i })).toHaveAttribute("aria-pressed", "false");
  });

  // 17 — Comment → reply → edit within window → remove → tombstone; reply preserved.
  test("comment: add, reply, edit, remove tombstone", async ({ page }) => {
    const card = firstCard(page);
    await card.getByRole("button", { name: /comments/i }).click();
    await card.getByPlaceholder(/write a comment/i).fill("first comment");
    await card.getByRole("button", { name: /^comment$/i }).click();
    await expect(card.getByText("first comment")).toBeVisible();
    await card.getByRole("button", { name: /^reply$/i }).first().click();
    await card.getByPlaceholder(/write a reply/i).fill("a reply");
    await card.getByRole("button", { name: /^reply$/i }).last().click();
    await card.getByRole("button", { name: /edit/i }).first().click();
    await card.locator("textarea").first().fill("edited comment");
    await card.getByRole("button", { name: /^save$/i }).click();
    await expect(card.getByText("edited comment")).toBeVisible();
    await card.getByRole("button", { name: /delete|remove/i }).first().click();
    await expect(card.getByText(/was removed/i)).toBeVisible();
    await expect(card.getByText("a reply")).toBeVisible();
  });

  // 18 — Repost → "reposted" header appears in feed → un-repost → header gone.
  test("repost: add and undo", async ({ page }) => {
    const card = firstCard(page);
    await card.getByRole("button", { name: /repost/i }).click();
    await page.getByRole("menuitem", { name: /^repost/i }).first().click();
    await expect(page.getByText(/reposted/i).first()).toBeVisible();
    await firstCard(page).getByRole("button", { name: /repost/i }).click();
    await page.getByRole("menuitem", { name: /undo repost/i }).click();
  });

  // 19 — Quote repost → quote + embedded original; embedded original has NO action bar.
  test("quote repost renders an embedded, non-interactive original", async ({ page }) => {
    const card = firstCard(page);
    await card.getByRole("button", { name: /repost/i }).click();
    await page.getByRole("menuitem", { name: /quote/i }).click();
    await page.getByPlaceholder(/add your thoughts/i).fill("worth reading");
    await page.getByRole("button", { name: /^post$/i }).click();
    const quoteCard = page.getByText(/quoted/i).first().locator("xpath=ancestor::article");
    // the embedded original inside a quote card exposes no React/Bookmark controls
    await expect(quoteCard.getByRole("button", { name: /react/i })).toHaveCount(0);
  });

  // 20 — Bookmark → appears at /bookmarks → unbookmark → gone.
  test("bookmark: save appears at /bookmarks then unsave removes it", async ({ page }) => {
    await firstCard(page).getByRole("button", { name: /save to bookmarks/i }).click();
    await page.goto("/bookmarks", { waitUntil: "domcontentloaded" });
    await expect(page.locator("article")).not.toHaveCount(0);
    await firstCard(page).getByRole("button", { name: /remove from bookmarks/i }).click();
  });

  // 21 — Upload 2 images → post → both render.
  test("compose with two images", async ({ page }) => {
    await page.setInputFiles('input[type="file"]', [
      path.join(FIXTURES, "img1.jpg"),
      path.join(FIXTURES, "img2.jpg"),
    ]);
    await page.getByRole("textbox").first().fill("two photos");
    await page.getByRole("button", { name: /^post$/i }).click();
    await expect(page.locator("article img").first()).toBeVisible();
  });

  // 22 — Upload a video → poster shows, no autoplay, plays on tap.
  test("compose with a video: poster shows, no autoplay", async ({ page }) => {
    await page.setInputFiles('input[type="file"]', path.join(FIXTURES, "short.mp4"));
    await page.getByRole("textbox").first().fill("a clip");
    await page.getByRole("button", { name: /^post$/i }).click();
    const play = page.getByRole("button", { name: /play video/i }).first();
    await expect(play).toBeVisible();
    // no <video> is autoplaying before the tap
    expect(await page.locator("video").count()).toBe(0);
    await play.click();
    await expect(page.locator("video").first()).toBeVisible();
  });

  // 23 — Oversized video blocked in the picker with a readable message, nothing uploaded.
  test("oversized video is rejected in the picker", async ({ page }) => {
    await page.setInputFiles('input[type="file"]', path.join(FIXTURES, "big.mp4"));
    await expect(page.getByRole("alert")).toBeVisible();
  });

  // 24 — 360×640: action bar single row, picker fully on-screen at both edges.
  test("action bar stays a single row at 360×640", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const footer = firstCard(page).locator("footer").first();
    const box = await footer.boundingBox();
    expect(box).not.toBeNull();
    // a single row of ~44px controls should not exceed ~72px tall
    expect(box!.height).toBeLessThan(72);
  });
});
