import { createClient } from "@supabase/supabase-js";
import { THREAD_AB, ATTACHMENT_BUCKET } from "./constants";

// D-060 — the E2E suite writes to the LIVE Supabase project, so it MUST clean up
// after itself; residue in prod is a defect, not acceptable noise. After the run,
// authenticated AS ACCOUNT A (the only writer), this:
//   1. hard-deletes every attachment object A uploaded under the A<->B thread — the
//      storage DELETE policy is uploader-owns ({thread}/{uploader}/*), so this nukes
//      A's whole uploader subtree there (self-healing: clears prior leaked residue
//      too, since A + THREAD_AB are dedicated E2E identities); and
//   2. tombstones the messages A sent in that thread during this run via
//      delete_message_for_everyone — the ONLY client mutation path (public.messages
//      has NO DELETE/UPDATE policy by design; the RPC nulls body + attachments and
//      drops reactions inside a 60-min window). The tombstone ROW remains — true row
//      removal needs a service-role sweep, which the client deliberately cannot do.
// Fails loudly on any API error (Playwright marks the run failed). No-op when the
// authenticated suite skipped (no E2E creds → nothing was created).
//
// NOTE: only account A writes in the current suite. If a future spec uploads/sends
// as B or C, extend this to their identities + threads.

const WINDOW_MIN = 55; // stay inside the RPC's 60-min delete window, with margin

export default async function globalTeardown() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    console.log("[e2e-teardown] no E2E creds — authenticated suite skipped; nothing to clean.");
    return;
  }
  if (!url || !anon) {
    throw new Error(
      "[e2e-teardown] E2E creds present but NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY missing — cannot clean prod residue."
    );
  }

  const supabase = createClient(url, anon, { auth: { persistSession: false } });
  const { data: authData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  if (signInErr || !authData.user) {
    throw new Error(`[e2e-teardown] sign-in as account A failed: ${signInErr?.message ?? "no user returned"}`);
  }
  const aId = authData.user.id;

  // 1) Storage: hard-delete A's uploader subtree under the A<->B thread (paginated).
  const prefix = `${THREAD_AB}/${aId}`;
  const paths: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).list(prefix, { limit: 100, offset });
    if (error) throw new Error(`[e2e-teardown] storage list failed: ${error.message}`);
    const page = data ?? [];
    for (const o of page) if (o.id) paths.push(`${prefix}/${o.name}`); // o.id null = pseudo-folder
    if (page.length < 100) break;
  }
  let objectsRemoved = 0;
  if (paths.length) {
    const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).remove(paths);
    if (error) throw new Error(`[e2e-teardown] storage remove failed: ${error.message}`);
    objectsRemoved = paths.length;
  }

  // 2) Messages: tombstone A's un-deleted messages in the thread from this run (i.e.
  //    still inside the RPC's delete window). Anything older is pre-teardown residue
  //    the window can no longer touch — reported, not failed.
  const cutoffIso = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const { data: msgs, error: qErr } = await supabase
    .from("messages")
    .select("id, created_at")
    .eq("thread_id", THREAD_AB)
    .eq("sender_id", aId)
    .is("deleted_at", null);
  if (qErr) throw new Error(`[e2e-teardown] message query failed: ${qErr.message}`);

  const rows = (msgs ?? []) as Array<{ id: string; created_at: string }>;
  const fresh = rows.filter((m) => m.created_at >= cutoffIso);
  const stale = rows.length - fresh.length;
  let tombstoned = 0;
  for (const m of fresh) {
    const { error } = await supabase.rpc("delete_message_for_everyone", { p_id: m.id });
    if (error) throw new Error(`[e2e-teardown] tombstone ${m.id} failed: ${error.message}`);
    tombstoned++;
  }

  await supabase.auth.signOut();
  console.log(
    `[e2e-teardown] removed ${objectsRemoved} storage object(s); tombstoned ${tombstoned} message(s) in the A-B thread` +
      (stale ? `; left ${stale} older message row(s) (outside the 60-min delete window — needs a service-role sweep).` : ".")
  );
}
