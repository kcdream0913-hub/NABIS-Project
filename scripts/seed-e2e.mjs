// scripts/seed-e2e.mjs — seed the DEDICATED E2E Supabase project (BL-E2E-SPLIT-01 / D-085).
// Repeatable + idempotent. This environment is rebuilt periodically, so it is a SCRIPT, not
// manual SQL. ⚠ NEVER run against prod — it refuses the prod project ref.
//
// Run:
//   SUPABASE_URL=<E2E project url> SUPABASE_SERVICE_ROLE_KEY=<E2E service-role key> \
//     node scripts/seed-e2e.mjs
//
// Seeds exactly the fixtures the Playwright suite requires:
//   - 3 accounts: A (Alpha), B (Bravo), C (Charlie) — ALL VERIFIED.
//     ⚠ They MUST be verified. BL-TRUST-01 (D-082) gates posting / commenting / quote-reposting
//     on verification_status='verified'; an unverified seed makes EVERY content test fail.
//     verification_status / verified_at / bridge are GENERATED columns — a direct write raises
//     428C9 — so verification is set via the BASE column us_verification='verified'.
//   - the A<->B DM thread          → print its id for e2e/constants.ts THREAD_AB
//   - a B<->C thread A is NOT in, with a foreign attachment object
//                                  → print its path for the E2E_FOREIGN_ATTACHMENT_PATH secret
// Prints every value CI needs. NEVER prints the service-role key.

import { createClient } from "@supabase/supabase-js";
import { Buffer } from "node:buffer";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // service role — required
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (the E2E project's — NOT prod).");
  process.exit(1);
}
// Hard guard: never seed prod.
if (url.includes("dhnggnxwjgqvghbxelvw")) {
  console.error("REFUSING to run: SUPABASE_URL is the PROD project. Point at the E2E project.");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const PASSWORD = process.env.E2E_SEED_PASSWORD || "SangamlineE2E2026!";
const ACCOUNTS = [
  { tag: "A", email: "e2e-alpha@sangamline.test",   name: "E2E Alpha",   country: "us",    sectors: ["technology-ai"] },
  { tag: "B", email: "e2e-bravo@sangamline.test",   name: "E2E Bravo",   country: "us",    sectors: ["technology-ai"] },
  { tag: "C", email: "e2e-charlie@sangamline.test", name: "E2E Charlie", country: "nepal", sectors: ["technology-ai"] },
];
const ATTACHMENT_BUCKET = "message-attachments";

async function getOrCreateUser(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (!error) return data.user.id;
  if (!/already|registered|exists/i.test(error.message)) throw error;
  for (let page = 1; page <= 20; page++) {
    const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const u = list.users.find((x) => x.email === email);
    if (u) return u.id;
    if (list.users.length < 200) break;
  }
  throw new Error("user exists but not found: " + email);
}

async function verifyProfile(id, name, country, sectors) {
  // handle_new_user makes the profiles row on createUser; UPDATE it. Setting the BASE column
  // us_verification='verified' flips the GENERATED verification_status to 'verified'. NEVER
  // write verification_status / verified_at / bridge (428C9 — cannot update a generated column).
  const { error } = await admin.from("profiles").update({
    name, country, sectors,
    us_verification: "verified",
    us_verified_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) throw error;
}

async function findThread(u1, u2) {
  const { data } = await admin.from("direct_thread_participants").select("thread_id, user_id").in("user_id", [u1, u2]);
  const byThread = new Map();
  for (const r of data ?? []) {
    const s = byThread.get(r.thread_id) ?? new Set();
    s.add(r.user_id);
    byThread.set(r.thread_id, s);
  }
  for (const [tid, members] of byThread) if (members.has(u1) && members.has(u2)) return tid;
  return null;
}

async function getOrCreateThread(u1, u2) {
  const existing = await findThread(u1, u2);
  if (existing) return existing;
  const { data: t, error } = await admin.from("direct_threads").insert({}).select("id").single();
  if (error) throw error;
  const { error: pe } = await admin.from("direct_thread_participants").insert([
    { thread_id: t.id, user_id: u1 },
    { thread_id: t.id, user_id: u2 },
  ]);
  if (pe) throw pe;
  return t.id;
}

const ids = {};
for (const a of ACCOUNTS) {
  const id = await getOrCreateUser(a.email);
  await verifyProfile(id, a.name, a.country, a.sectors);
  ids[a.tag] = id;
  console.log(`account ${a.tag}: ${a.email} → ${id} (verified via us_verification)`);
}

const threadAB = await getOrCreateThread(ids.A, ids.B);
const threadBC = await getOrCreateThread(ids.B, ids.C); // A is NOT a participant

// Foreign attachment: a real object in the B<->C thread (uploaded by B). Account A is not a
// participant, so the signed-URL route returns 403 for it — the negative-access test. A tiny
// valid JPEG (SOI + EOI) is enough; the object only needs to EXIST and A to be denied.
const foreignPath = `${threadBC}/${ids.B}/foreign.jpg`;
{
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0xff, 0xd9]);
  const { error } = await admin.storage.from(ATTACHMENT_BUCKET).upload(foreignPath, jpg, { contentType: "image/jpeg", upsert: true });
  if (error && !/exists/i.test(error.message)) throw error;
}

console.log("\n── set these as the E2E CI secrets (VALUES only — never commit) ─────────────────");
console.log("E2E_SUPABASE_URL              =", url);
console.log("E2E_SUPABASE_ANON_KEY        = <the E2E project's anon/publishable key — Supabase dashboard → Project Settings → API>");
console.log("E2E_EMAIL                    =", ACCOUNTS[0].email, " (account A)");
console.log("E2E_PASSWORD                 =", PASSWORD);
console.log("E2E_FOREIGN_ATTACHMENT_PATH  =", foreignPath);
console.log("\n── update this ONE code constant in the repo (e2e/constants.ts) ─────────────────");
console.log("export const THREAD_AB =", JSON.stringify(threadAB) + ";");
console.log("\nDone. Accounts A/B/C are verified; A<->B thread + B<->C foreign object seeded.");
