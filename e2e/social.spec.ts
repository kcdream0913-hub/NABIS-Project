import { test, expect, type Page } from "@playwright/test";
import { login } from "./_login";
import { MARKER_POST_ID } from "./constants";

// BL-SOCIAL-03b (PENDING) — the 5 feed SOCIAL-ACTION tests (react / comment / repost /
// quote / bookmark). The media path (compose images/video, oversized, action-bar
// layout) shipped in BL-SOCIAL-03a as e2e/feed-media.spec.ts. These five still need
// their bodies REWRITTEN against the shipped selectors: the spec-authored names below
// (/react/i, /comments/i, …) do NOT match the real PostActionBar, whose accessible
// names are "Like" / "Comment" / "Repost" / "Share" / "Bookmark" (+ ReactionPicker,
// CommentThread, QuoteComposer). They target the hub-seeded marker post (MARKER_POST_ID).
//
// SKIPPED as a block until 03b rewrites them — see D-059 accepted-and-unguarded. The
// skip is LOUD (below) so it can't quietly rot into a green.
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

if (EMAIL && PASSWORD) {
  // eslint-disable-next-line no-console
  console.warn(
    "\n[social.spec] SKIPPING 5 BL-SOCIAL-03b social-action cases (react/comment/repost/quote/" +
      "bookmark): bodies still use spec-authored selectors and must be rewritten against the " +
      "shipped PostActionBar before they can run. NOT verified.\n",
  );
}

test.describe("feed social actions (authenticated)", () => {
  // Whole block gated on 03b: the bodies below are placeholders pending a selector
  // rewrite. Do not un-skip without rewriting them against the shipped components.
  test.skip(true, "BL-SOCIAL-03b — social-action selectors pending rewrite against the shipped UI");

  const marker = (page: Page) => page.locator("article", { hasText: /./ }).first();

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`/posts/${MARKER_POST_ID}`, { waitUntil: "domcontentloaded" });
  });

  // 16 — react: like → change kind → unlike (post_reactions).
  test("react: like, change kind, unlike", async ({ page }) => {
    const card = marker(page);
    const react = card.getByRole("button", { name: /react/i });
    await react.click();
    await expect(react).toHaveAttribute("aria-pressed", "true");
  });

  // 17 — comment: add / reply / edit / remove tombstone (post_comments).
  test("comment: add, reply, edit, remove tombstone", async ({ page }) => {
    const card = marker(page);
    await card.getByRole("button", { name: /comments/i }).click();
    await card.getByPlaceholder(/write a comment/i).fill("first comment");
    await card.getByRole("button", { name: /^comment$/i }).click();
    await expect(card.getByText("first comment")).toBeVisible();
  });

  // 18 — repost: add and undo (post_reposts).
  test("repost: add and undo", async ({ page }) => {
    const card = marker(page);
    await card.getByRole("button", { name: /repost/i }).click();
    await page.getByRole("menuitem", { name: /^repost/i }).first().click();
  });

  // 19 — quote repost renders an embedded, non-interactive original.
  test("quote repost renders an embedded, non-interactive original", async ({ page }) => {
    const card = marker(page);
    await card.getByRole("button", { name: /repost/i }).click();
    await page.getByRole("menuitem", { name: /quote/i }).click();
  });

  // 20 — bookmark: save → appears at /bookmarks → unsave (post_bookmarks).
  test("bookmark: save appears at /bookmarks then unsave removes it", async ({ page }) => {
    await marker(page).getByRole("button", { name: /save to bookmarks/i }).click();
    await page.goto("/bookmarks", { waitUntil: "domcontentloaded" });
    await expect(page.locator("article")).not.toHaveCount(0);
  });
});
