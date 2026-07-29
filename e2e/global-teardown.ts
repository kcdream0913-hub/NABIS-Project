import { createClient } from "@supabase/supabase-js";
import { THREAD_AB, ATTACHMENT_BUCKET, POST_MEDIA_BUCKET } from "./constants";

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
//      removal needs a service-role sweep, which the client deliberately cannot do; and
//   3. (BL-SOCIAL-03a) hard-deletes A's composed feed posts (posts_delete_own) and
//      their post-media objects (post_media_delete_own). A authors 0 posts outside the
//      suite, so this is self-healing; and
//   4. (BL-SOCIAL-03b) hard-deletes A's reactions/reposts/bookmarks (delete_own) and
//      tombstones A's live comments (no client DELETE — soft-delete only). A-scoped, so
//      the marker's non-E2E seed reaction/comment are never touched.
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

  // 3) Feed (BL-SOCIAL-03a): hard-delete A's composed posts + their post-media
  //    objects. A authors 0 posts outside the suite, so deleting ALL of A's posts is
  //    safe + self-healing. Both are hard-deletable (posts_delete_own /
  //    post_media_delete_own — unlike messages, posts CAN be removed by the author).
  const { data: delPosts, error: postErr } = await supabase
    .from("posts")
    .delete()
    .eq("author_id", aId)
    .select("id");
  if (postErr) throw new Error(`[e2e-teardown] post delete failed: ${postErr.message}`);
  const postsDeleted = (delPosts ?? []).length;

  const mediaPaths: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(POST_MEDIA_BUCKET).list(aId, { limit: 100, offset });
    if (error) throw new Error(`[e2e-teardown] post-media list failed: ${error.message}`);
    const page = data ?? [];
    for (const o of page) if (o.id) mediaPaths.push(`${aId}/${o.name}`);
    if (page.length < 100) break;
  }
  let mediaRemoved = 0;
  if (mediaPaths.length) {
    const { error } = await supabase.storage.from(POST_MEDIA_BUCKET).remove(mediaPaths);
    if (error) throw new Error(`[e2e-teardown] post-media remove failed: ${error.message}`);
    mediaRemoved = mediaPaths.length;
  }

  // 4) Feed social actions (BL-SOCIAL-03b): hard-delete A's reactions / reposts /
  //    bookmarks (all delete_own). Comments have NO client DELETE (soft-delete only) —
  //    so tombstone any of A's LIVE comments; the tombstone ROW itself is the accepted
  //    residual (same class as message tombstones, hub-swept). A-scoped, so the marker's
  //    seed reaction/comment (authored by a non-E2E account) are never touched.
  const del = async (table: string, col: string) => {
    const { data, error } = await supabase.from(table).delete().eq(col, aId).select("post_id");
    if (error) throw new Error(`[e2e-teardown] ${table} delete failed: ${error.message}`);
    return (data ?? []).length;
  };
  const reactionsDeleted = await del("post_reactions", "user_id");
  const repostsDeleted = await del("post_reposts", "user_id");
  const bookmarksDeleted = await del("post_bookmarks", "user_id");

  const { data: liveComments, error: cErr } = await supabase
    .from("post_comments")
    .select("id")
    .eq("author_id", aId)
    .is("deleted_at", null);
  if (cErr) throw new Error(`[e2e-teardown] comment query failed: ${cErr.message}`);
  let commentsTombstoned = 0;
  if (liveComments && liveComments.length) {
    const { error } = await supabase
      .from("post_comments")
      .update({ deleted_at: new Date().toISOString() })
      .eq("author_id", aId)
      .is("deleted_at", null);
    if (error) throw new Error(`[e2e-teardown] comment tombstone failed: ${error.message}`);
    commentsTombstoned = liveComments.length;
  }

  await supabase.auth.signOut();
  console.log(
    `[e2e-teardown] A-B thread: removed ${objectsRemoved} attachment object(s), tombstoned ${tombstoned} message(s)` +
      (stale ? ` (left ${stale} older row(s) past the 60-min window — needs a service-role sweep)` : "") +
      `; feed: deleted ${postsDeleted} post(s) + ${mediaRemoved} post-media object(s)` +
      `; social: deleted ${reactionsDeleted} reaction(s) / ${repostsDeleted} repost(s) / ${bookmarksDeleted} bookmark(s), tombstoned ${commentsTombstoned} comment(s).`
  );
}
