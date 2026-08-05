-- 20260804043523_avatars_scoped_select_own.sql
-- BL-AVATAR-02 / D-084 — SCOPED owner-only SELECT on the public `avatars` bucket.
--
-- ⚠ ALREADY APPLIED TO PROD 2026-08-04 by the hub, AHEAD of this branch merging — recorded in
--   prod's supabase_migrations as version 20260804043523. This file is the REPO PROVENANCE for a
--   policy that was live in prod with NO matching file on origin/main (the drift D-084 flags, and
--   the drift the D-085 baseline dump would otherwise freeze in silently). Do NOT re-run it against
--   prod: the version is already recorded, so `supabase db push` skips it. On a FRESH database it
--   creates the policy exactly once, which is correct.
--
-- WHY: BL-AVATAR-01 dropped the broad `avatars_select` to clear the advisor's
--   public_bucket_allows_listing finding — which silently BROKE deletion. The Storage API resolves
--   an object via SELECT before remove(), so with no SELECT policy the owner saw 0 rows and
--   remove() no-op'd (a public, permanently-fetchable orphan). This restores a SCOPED, owner-only
--   SELECT: deletion can resolve the object AGAIN, and enumeration stays closed because the finding
--   flags the BROAD bucket_id-only predicate, not SELECT itself. Public reads are unaffected (a
--   public bucket serves object URLs without RLS).
--
-- Canonical, self-documenting source (identical DDL): docs/BL-AVATAR-02.sql
--   (+ docs/BL-AVATAR-02.verify.sql — 5/5 in begin/rollback — and docs/ROLLBACK_BL-AVATAR-02.sql).

create policy "avatars_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and private.can_write_avatar(name));
