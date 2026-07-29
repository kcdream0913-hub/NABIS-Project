import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { THREAD_AB } from "./constants";

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
// THREAD_AB (the hub-seeded A<->B thread, account A a participant) is imported from
// ./constants so the teardown scopes cleanup to the same thread. Used for the
// participant flows so we never create a thread at runtime. NOTE: FOREIGN is a real
// B-C path with a storage row but NO S3 bytes — it is for the 403 DENIAL assertion
// ONLY; a positive read would 404, so never assert a successful read against it.

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

// The "+" attach trigger — scoped by aria-label because the notification bells (rail
// + topbar) ALSO carry aria-haspopup="menu". The sheet menu + its rows are scoped the
// same way (the bell panel is role="menu"/"menuitem" too).
const trigger = (page: Page) => page.getByRole("button", { name: "Attach a file", exact: true });
const sheet = (page: Page) => page.getByRole("menu", { name: "Attach a file" });
const sheetItem = (page: Page, i: number) => sheet(page).getByRole("menuitem").nth(i);
const sendBtn = (page: Page) => page.getByRole("button", { name: /send message/i });

async function login(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  // The login form is a client component with React-controlled inputs. Wait for
  // hydration before filling — filling on domcontentloaded can set the DOM value
  // BEFORE onChange is attached, leaving React state empty (signInWithPassword then
  // errors "missing email or phone"). toHaveValue confirms the field took the value.
  await page.waitForLoadState("networkidle");
  const email = page.getByLabel(/email/i);
  const pw = page.getByLabel(/password/i);
  await email.fill(EMAIL!);
  await pw.fill(PASSWORD!);
  await expect(email).toHaveValue(EMAIL!);
  await expect(pw).toHaveValue(PASSWORD!);
  await page.getByRole("button", { name: /log in|sign in/i }).click();
  // Login succeeds -> navigates off /login (an error keeps us here and this throws).
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 20_000 });
}

// Open the real A-B thread directly; /messages/<id> renders ThreadConversation, whose
// footer holds the "+" attachment trigger. Thread creation is NOT under test here.
// PRECONDITION: account A must have preferences.onboarded = true, or OnboardingRedirect
// bounces every app route to /welcome and the composer never renders. The hub-seeded
// A/B/C are onboarded; keep that in the seed so CI is stable.
async function openThread(page: Page) {
  await page.goto(`/messages/${THREAD_AB}`, { waitUntil: "domcontentloaded" });
  // The trigger is disabled until ThreadConversation resolves the current user; wait
  // for enabled so the click in each test lands.
  await expect(trigger(page)).toBeEnabled({ timeout: 15_000 });
}

// Open the sheet and hand a file to the input behind the given row via the native
// filechooser (the rows trigger a hidden <input> .click()).
async function pick(page: Page, rowIndex: number, file: string) {
  await trigger(page).click();
  await expect(sheet(page)).toBeVisible();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    sheetItem(page, rowIndex).click(),
  ]);
  await chooser.setFiles(file);
}

// Happy path: pick, wait for the upload+scan round-trip (the scan is a GET to the
// attachment route), then send.
async function pickAndSend(page: Page, rowIndex: number, file: string) {
  await trigger(page).click();
  await expect(sheet(page)).toBeVisible();
  const scan = page.waitForResponse((r) => r.url().includes("/api/messages/attachment"), { timeout: 30_000 });
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    sheetItem(page, rowIndex).click(),
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
    await openThread(page);
  });

  test("sheet opens on click, closes on Esc (focus returns) and on outside click", async ({ page }) => {
    const t = trigger(page);
    await t.click();
    await expect(t).toHaveAttribute("aria-expanded", "true");
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByRole("menuitem")).toHaveCount(3); // Document / Photos & videos / Camera
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toHaveCount(0);
    await expect(t).toBeFocused();
    await t.click();
    await expect(sheet(page)).toBeVisible();
    // Raw mouse click (no actionability check) at upper-center: outside the popover
    // on desktop and onto the sheet backdrop on mobile — closes either layout without
    // hitting a nav control. The mobile backdrop would intercept a locator.click().
    const w = page.viewportSize()?.width ?? 800;
    await page.mouse.click(Math.floor(w / 2), 150);
    await expect(sheet(page)).toHaveCount(0);
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
