import { createClient } from "@supabase/supabase-js";

// Per-run, self-provisioned feed TARGET post (Option C — no production changes). The
// E2E suites used to point at a PERMANENT seeded "marker" post, which meant a
// "E2E marker post - do not delete" row sat in every real user's `us` feed forever.
// Instead, account A creates its own target at run time (posts_insert_own), the tests
// drive it via its permalink, and global-teardown hard-deletes it (posts_delete_own).
// Its reactions/comments/reposts/bookmarks CASCADE with the post (all four FKs are
// ON DELETE CASCADE), so nothing is left behind — not even a comment tombstone.
//
// Accepted tradeoff (D-059): the post is view='us', so it is briefly visible in the
// live feed for the duration of a run — bounded, identical to what the compose tests
// already do, and pre-pilot the only real user is KC. The real fix is a SEPARATE
// Supabase project for E2E (pre-pilot HARD BLOCKER — see CLAUDE.md).
export async function createTargetPost(tag: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!url || !anon || !email || !password) {
    throw new Error("createTargetPost requires NEXT_PUBLIC_SUPABASE_URL/_ANON_KEY + E2E_EMAIL/_PASSWORD");
  }
  const sb = createClient(url, anon, { auth: { persistSession: false } });
  const { data: auth, error: signInErr } = await sb.auth.signInWithPassword({ email, password });
  if (signInErr || !auth.user) throw new Error(`createTargetPost sign-in failed: ${signInErr?.message ?? "no user"}`);
  const { data, error } = await sb
    .from("posts")
    .insert({ author_id: auth.user.id, view: "us", body: `[e2e] ${tag} — auto-deleted by teardown`, body_lang: "en" })
    .select("id")
    .single();
  // scope: "local" — clear ONLY this ephemeral Node session. The default global
  // signOut revokes A's refresh tokens EVERYWHERE, which would kill the logged-in
  // browser sessions of the concurrent tests (their next getUser() returns null →
  // compose/publish silently no-ops). This helper runs mid-suite, so it must not.
  await sb.auth.signOut({ scope: "local" });
  if (error || !data) throw new Error(`createTargetPost insert failed: ${error?.message ?? "no row returned"}`);
  return data.id as string;
}
