-- BL-TRUST-01 — server-side verification gate on content writes (posts + post_comments).
--
-- WHY: CLAUDE.md's Trust backlog records that the "verified to post" rule is CLIENT-SIDE
-- ONLY (composer.tsx hides the textarea; the DB enforces nothing), and the comment path was
-- never gated at all. The project pillar is "all features integrate with KYC gating";
-- server-side, that gate did not exist. All five content-insert policies were bare ownership
-- checks with no verification predicate.
--
-- SCOPE — DELIBERATELY posts + post_comments ONLY. Reactions / reposts / bookmarks are LEFT
-- UNGATED (see D-082). Blast radius measured live on prod (dhnggnxwjgqvghbxelvw) 2026-08-04:
--   posts          16 rows — all 16 by VERIFIED authors   -> gating changes 0 behaviour today; closes a real client/server divergence.
--   post_comments   3 rows — all 3 by UNVERIFIED authors   -> real but bounded behaviour change; same abuse surface as posts.
--   post_reactions 76 rows — 58 (76%) by UNVERIFIED users  -> gating would block the cheapest engagement action; NOT done.
-- Gating reactions/reposts/bookmarks would invent a NEW product rule (they were never
-- client-gated either), block 76% of current reaction activity for near-zero abuse value
-- (a fake like is worthless), and is a separate deliberate product decision — NOT folded in.
--
-- COMMIT this file; DO NOT APPLY it. The hub verifies it in a begin/rollback against prod
-- (see BL-TRUST-01.verify.sql), then applies. Statements are not wrapped in begin/commit so
-- the verifier can wrap them; the migration runner applies the whole file atomically.
--
-- Verified live 2026-08-04 (read-only, not asserted):
--   posts_insert_own          = {authenticated}, with_check (author_id = auth.uid())
--   post_comments_insert_own  = {public},        with_check (author_id = auth.uid())
--   private.can_view_profile / is_admin exist (SQL, STABLE, SECURITY DEFINER, search_path
--     'public'; EXECUTE granted to authenticated only — proacl {postgres=X,authenticated=X};
--     authenticated has USAGE on schema private). The new helper mirrors this exactly.
--   private.is_trusted_writer() = `select auth.uid() is null or private.is_admin()` — a
--     service/admin check, NOT a verification gate. Inspected and DELIBERATELY NOT reused.
--   KC 1 (1258b010-291b-434c-a6a4-a1f6fee0d9b9) is UNVERIFIED and the SOLE admin_users row —
--     without the admin branch this migration would lock the founder out of posting and
--     commenting on his own platform. The admin branch mirrors the one in can_view_profile.
--
-- NOTE: verification_status is a GENERATED column (derived from us_/np_verification); this
-- helper only READS it. A direct write to it raises 428C9 — never write it.

-- 1. Verification-gate helper. Same shape as private.can_view_profile: SQL, STABLE,
--    SECURITY DEFINER, search_path pinned to 'public'. It reads ONLY the caller's own row, so
--    it leaks nothing; the admin branch keeps the sole admin (KC) able to write while
--    unverified. Uses (select auth.uid()) so it is evaluated once (initplan-friendly).
create or replace function private.can_write_content()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    coalesce(
      (select p.verification_status from profiles p where p.id = (select auth.uid())),
      'unverified'
    ) = 'verified'
    or private.is_admin();
$$;

-- Grant hygiene, mirroring can_view_profile ({postgres=X, authenticated=X}). Per D-057 the
-- revoke MUST name public — the default EXECUTE grant on any function is to PUBLIC, so naming
-- only anon/authenticated is a silent no-op. anon is not granted (it has no USAGE on the
-- private schema either).
revoke execute on function private.can_write_content() from public, anon, authenticated;
grant  execute on function private.can_write_content() to authenticated;

-- 2. Gate the two content-insert policies: AND the verification predicate onto the EXISTING
--    ownership check (never replace it). (select auth.uid()) — NOT bare auth.uid() — so this
--    does not add a 60th auth_rls_initplan advisor WARN.
drop policy posts_insert_own on public.posts;
create policy posts_insert_own on public.posts
  for insert to authenticated
  with check ((author_id = (select auth.uid())) and private.can_write_content());

-- post_comments_insert_own is currently role {public}; NORMALISE it to {authenticated} in the
-- same migration — an anon insert path onto user content should not exist.
drop policy post_comments_insert_own on public.post_comments;
create policy post_comments_insert_own on public.post_comments
  for insert to authenticated
  with check ((author_id = (select auth.uid())) and private.can_write_content());
