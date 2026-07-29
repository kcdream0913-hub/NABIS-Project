import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { login } from "./_login";
import { createTargetPost } from "./_target";

// BL-SOCIAL-03b — the 5 feed SOCIAL-ACTION tests, rewritten against the SHIPPED UI
// (the spec-authored /react/i-style selectors did not match: the real PostActionBar
// exposes "Like" / "Comment" / "Repost" / "Share" / "Bookmark"). They drive the real
// components as verified account A against a per-run SELF-PROVISIONED target post
// (Option C — no permanent fixture in real users' feeds; createTargetPost). A can
// react/comment/repost/quote/bookmark its own post; teardown hard-deletes it and its
// engagement CASCADES away (so NO comment-tombstone residue — comments live on A's own
// post, which is hard-deleted).
//
// SERIAL + CHROMIUM-ONLY, deliberately:
//   • post_reposts PK is (post_id, user_id) → one repost row per (post, user), so the
//     repost and quote tests share a row and MUST NOT run concurrently.
//   • all five mutate the SAME target as the SAME account; two viewport projects would
//     collide on those rows. The 360px action-bar LAYOUT is already covered by
//     feed-media.spec (test 24), so running the actions once (chromium) loses nothing.

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

let targetId: string; // A's per-run target post; created lazily in the first beforeEach
const targetCard = (page: Page) => page.locator("article").first(); // permalink = one article

test.describe.serial("feed social actions (authenticated)", () => {
  test.skip(!EMAIL || !PASSWORD, "set E2E_EMAIL / E2E_PASSWORD (verified account A) to run");

  test.beforeEach(async ({ page }, testInfo) => {
    // Run once, on chromium — these actions aren't viewport-dependent and would collide
    // across projects on the shared target/account. (360 layout → feed-media test 24.)
    test.skip(testInfo.project.name !== "chromium", "social actions run once on chromium; 360 layout is covered by feed-media");
    if (!targetId) targetId = await createTargetPost("social target"); // once (serial)
    await login(page);
    await page.goto(`/posts/${targetId}`, { waitUntil: "domcontentloaded" });
    await expect(targetCard(page).getByRole("button", { name: "Like" })).toBeVisible({ timeout: 15_000 });
  });

  // 16 — react: like → persists across reload → change kind (picker) → remove.
  test("react: like, persist, change kind, remove", async ({ page }) => {
    const like = targetCard(page).getByRole("button", { name: "Like" });
    await like.click();
    await expect(like).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    const like2 = targetCard(page).getByRole("button", { name: "Like" });
    await expect(like2).toHaveAttribute("aria-pressed", "true"); // reaction was persisted

    // Hover opens the 5-kind picker; change to Namaste (still reacted, different kind).
    const picker = page.getByRole("menu", { name: "Choose a reaction" });
    await like2.hover();
    await expect(picker).toBeVisible({ timeout: 5_000 });
    await picker.getByRole("menuitemradio", { name: "Namaste" }).click();
    await expect(like2).toHaveAttribute("aria-pressed", "true");

    // Picking the CURRENT kind again removes it (clean end).
    await like2.hover();
    await expect(picker).toBeVisible({ timeout: 5_000 });
    await picker.getByRole("menuitemradio", { name: "Namaste" }).click();
    await expect(like2).toHaveAttribute("aria-pressed", "false");
  });

  // 17 — comment: add → edit within window → remove (soft-delete tombstone).
  test("comment: add, edit, remove tombstone", async ({ page }) => {
    const card = targetCard(page);
    // The permalink renders PostCard with defaultCommentsOpen, so the thread is ALREADY
    // open — clicking the "Comment" toggle here would CLOSE it. Use the open composer.
    const section = card.getByRole("region", { name: "Comments" });
    await expect(section).toBeVisible({ timeout: 15_000 });

    const token = `e2e-comment-${randomUUID()}`;
    await section.getByPlaceholder("Write a comment…").fill(token);
    await section.getByRole("button", { name: "Comment", exact: true }).click(); // composer submit
    await expect(section.getByText(token)).toBeVisible();

    // edit (author, within the 15-min window)
    const row = section.locator("li", { hasText: token }).first();
    await row.getByRole("button", { name: "Edit" }).click();
    const edited = `${token}-edited`;
    await row.locator("textarea").fill(edited);
    await row.getByRole("button", { name: "Save" }).click();
    await expect(section.getByText(edited)).toBeVisible();

    // remove → tombstone ("This comment was removed")
    await section.locator("li", { hasText: edited }).first().getByRole("button", { name: "Delete" }).click();
    await expect(section.getByText("This comment was removed").first()).toBeVisible();
  });

  // 18 — repost: add (→ pressed + toast) then undo (→ not pressed).
  test("repost: add and undo", async ({ page }) => {
    const repost = targetCard(page).getByRole("button", { name: "Repost", exact: true });
    await repost.click();
    await targetCard(page).getByRole("menuitem", { name: "Repost to US" }).click();
    await expect(repost).toHaveAttribute("aria-pressed", "true");
    await expect(targetCard(page).getByText("Reposted", { exact: true })).toBeVisible();

    // Undo, then WAIT for the DELETE to actually land — the optimistic aria-pressed
    // flips before the request completes, and the next (serial) test would otherwise
    // still see A as reposted (its repost menu shows "Undo repost", not "Quote").
    await repost.click();
    const undone = page.waitForResponse(
      (r) => r.url().includes("/post_reposts") && r.request().method() === "DELETE",
      { timeout: 15_000 },
    );
    await targetCard(page).getByRole("menuitem", { name: "Undo repost" }).click();
    await undone;
    await expect(repost).toHaveAttribute("aria-pressed", "false");
  });

  // 19 — quote repost: compose a quote → it appears in the feed as a NON-interactive
  // card (embedded original has no action bar).
  test("quote repost renders a non-interactive card in the feed", async ({ page }) => {
    const card = targetCard(page);
    await card.getByRole("button", { name: "Repost", exact: true }).click();
    await card.getByRole("menuitem", { name: "Quote" }).click();
    const token = `e2e-quote-${randomUUID()}`;
    await card.getByPlaceholder("Add your thoughts…").fill(token);
    await card.getByRole("button", { name: "Post", exact: true }).click(); // "Post" = postQuote
    await expect(card.getByText("Quote reposted")).toBeVisible();

    // The quote (view=us) lands in A's default feed; find it by the token.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const quoteCard = page.locator("article", { hasText: token });
    await expect(quoteCard).toBeVisible({ timeout: 15_000 });
    // The embedded original is read-only: a quote card renders no action bar.
    await expect(quoteCard.getByRole("button", { name: "Like" })).toHaveCount(0);
  });

  // 20 — bookmark: save → appears at /bookmarks → unsave.
  test("bookmark: save appears at /bookmarks then unsave", async ({ page }) => {
    const save = targetCard(page).getByRole("button", { name: "Save to bookmarks" });
    await save.click();
    await expect(targetCard(page).getByRole("button", { name: "Remove from bookmarks" })).toBeVisible();

    await page.goto("/bookmarks", { waitUntil: "domcontentloaded" });
    await expect(page.locator("article")).not.toHaveCount(0);

    // unsave (clean end)
    await page.locator("article").first().getByRole("button", { name: "Remove from bookmarks" }).click();
  });
});
