import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { randomUUID } from "node:crypto";

// BL-MSG-05 DM-attachment E2E (BL-E2E-01), porting the manual checklist. These are
// AUTHENTICATED and SKIP without E2E_EMAIL/E2E_PASSWORD (seeded pilot account A) - the
// same gate social.spec.ts uses, so CI stays green until the secrets + accounts exist.
// To run:
//   1. hub seeds accounts A, B, C, with an A<->B thread AND a B<->C thread A is NOT in
//   2. export E2E_EMAIL / E2E_PASSWORD for account A
//   3. (optional, strongest) export E2E_FOREIGN_ATTACHMENT_PATH="<B-C thread id>/<B id>/<file>"
//   4. npx playwright install && npm run test:e2e   (global-setup generates the fixtures)
// Selectors are taken from AttachmentSheet.tsx / AttachmentView.tsx / ThreadConversation.tsx.

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const FOREIGN = process.env.E2E_FOREIGN_ATTACHMENT_PATH; // "<thread_id>/<uploader_id>/<file>"

// Fixture names built numerically so this source stays pure ASCII (the .csv name is
// Devanagari; the .pdf name embeds U+202E). Must match scripts/gen-e2e-fixtures.mjs.
const cp = (...ns: number[]) => String.fromCodePoint(...ns);
const RLO = cp(0x202e);
const DEVANAGARI = cp(0x928, 0x92e, 0x938, 0x94d, 0x924, 0x947);
const GEN = path.join(__dirname, "fixtures", "generated");
const FX = {
  mzPdf: path.join(GEN, "invoice.pdf"),
  oversize: path.join(GEN, "oversize.mp4"),
  devanagariCsv: path.join(GEN, DEVANAGARI + ".csv"),
  bidiPdf: path.join(GEN, "report" + RLO + "fdp.pdf"),
  okPng: path.join(GEN, "ok.png"),
};
const DOC_ROW = 0; // menuitem order in the sheet: Document, Photos & videos, Camera
const MEDIA_ROW = 1;

const trigger = (page: Page) => page.locator('button[aria-haspopup="menu"]');
const sendBtn = (page: Page) => page.getByRole("button", { name: /send message/i });

async function login(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).fill(EMAIL!);
  await page.getByLabel(/password/i).fill(PASSWORD!);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"));
}

// Open the first conversation so the composer (with the "+" sheet) is present.
async function openFirstThread(page: Page) {
  await page.goto("/messages", { waitUntil: "domcontentloaded" });
  await page.locator('a[href*="/messages/"]').first().click();
  await expect(trigger(page)).toBeVisible();
}

// Open the sheet and hand a file to the input behind the given row via the native
// filechooser (the rows trigger a hidden <input> .click()).
async function pick(page: Page, rowIndex: number, file: string) {
  await trigger(page).click();
  await expect(page.getByRole("menu")).toBeVisible();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("menuitem").nth(rowIndex).click(),
  ]);
  await chooser.setFiles(file);
}

// Happy path: pick, wait for the upload+scan round-trip (the scan is a GET to the
// attachment route), then send.
async function pickAndSend(page: Page, rowIndex: number, file: string) {
  await trigger(page).click();
  await expect(page.getByRole("menu")).toBeVisible();
  const scan = page.waitForResponse((r) => r.url().includes("/api/messages/attachment"), { timeout: 30_000 });
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("menuitem").nth(rowIndex).click(),
  ]);
  await chooser.setFiles(file);
  await scan;
  await expect(sendBtn(page)).toBeEnabled();
  await sendBtn(page).click();
}

test.describe("DM attachments (authenticated)", () => {
  test.skip(!EMAIL || !PASSWORD, "set E2E_EMAIL / E2E_PASSWORD (seeded account A) to run");

  test.beforeEach(async ({ page }) => {
    await login(page);
    await openFirstThread(page);
  });

  test("sheet opens on click, closes on Esc (focus returns) and on outside click", async ({ page }) => {
    const t = trigger(page);
    await t.click();
    await expect(t).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("menu")).toBeVisible();
    await expect(page.getByRole("menuitem")).toHaveCount(3); // Document / Photos & videos / Camera
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(t).toBeFocused();
    await t.click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.mouse.click(2, 2); // outside
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  test("a valid image uploads, sends, and renders", async ({ page }) => {
    await pickAndSend(page, MEDIA_ROW, FX.okPng);
    await expect(page.locator("img[alt]").last()).toBeVisible();
  });

  test("a Devanagari-named CSV uploads and its name renders intact", async ({ page }) => {
    await pickAndSend(page, DOC_ROW, FX.devanagariCsv);
    await expect(page.getByText(new RegExp(DEVANAGARI)).last()).toBeVisible();
  });

  test("an executable renamed invoice.pdf is blocked by the server sniff (Unsupported file type)", async ({ page }) => {
    await pick(page, DOC_ROW, FX.mzPdf);
    // uploads, the read-route sniff sees MZ and 403s -> a staged error chip, never sent
    await expect(page.getByText("Unsupported file type")).toBeVisible({ timeout: 30_000 });
  });

  test("a >50MB file is rejected in the picker (File is too large)", async ({ page }) => {
    await pick(page, MEDIA_ROW, FX.oversize); // client size gate rejects before any upload
    await expect(page.getByText("File is too large")).toBeVisible();
  });

  test("a U+202E filename is sanitized before render (no override reaches the DOM)", async ({ page }) => {
    await pickAndSend(page, DOC_ROW, FX.bidiPdf);
    const card = page.getByText(/report.*\.pdf/i).last();
    await expect(card).toBeVisible();
    expect(await card.textContent()).not.toContain(RLO);
  });

  test("a non-participant is denied the signed URL (403, no url leaked)", async ({ page }) => {
    // Signed in as A, request a path in a thread A is not in. With a real B<->C path
    // (E2E_FOREIGN_ATTACHMENT_PATH) this is an RLS denial; with the synthesized
    // fallback it is a not-found - both MUST be 403 with NO `url` in the body.
    const foreign = FOREIGN ?? `${randomUUID()}/${randomUUID()}/nope.jpg`;
    const res = await page.request.get(`/api/messages/attachment?path=${encodeURIComponent(foreign)}`);
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.url).toBeUndefined();
  });
});
