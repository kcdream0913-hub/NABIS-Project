-- BL-AVATAR-02 — restore SELECT on the avatars bucket, SCOPED to the owner, so the Storage API
-- can RESOLVE (and therefore DELETE) an object. See D-084.
--
-- WHY / the causal chain (found by a live click-through on prod, NOT by a gate):
--   BL-AVATAR-01's advisor fix DROPPED the broad `avatars_select` policy entirely to clear the
--   `public_bucket_allows_listing` finding. That closed enumeration but ALSO broke deletion:
--   Supabase's Storage API resolves an object via SELECT before remove(), so with NO select policy
--   the OWNER saw ZERO rows, remove() matched nothing, and it no-op'd — SILENTLY, because the
--   route discarded the remove() error (fixed in the same branch). Consequence: every replace
--   leaked the old object, and "Remove photo" cleared the column while the object STAYED LIVE at a
--   public, permanently-fetchable URL — a PRIVACY defect, not a cleanup nit. "The app never lists
--   avatars" was true for READS (public URLs bypass RLS) but FALSE for deletes (the API needs
--   SELECT to resolve). Lesson: when you remove a permission, check what READS it, not just what
--   the advisor flags.
--
--   The advisor finding was about the BROAD `using (bucket_id='avatars')` — that let any client
--   LIST every object key. THIS policy is SCOPED to the owner (same predicate as
--   insert/update/delete), so a user sees only their OWN objects: remove() resolves AND
--   enumeration stays closed. Re-run the security advisor after applying — `public_bucket_allows_
--   listing` must STAY CLEAR (the broad predicate is what it flags, not SELECT itself). Public
--   reads are unaffected either way (a public bucket serves object URLs without RLS).
--
-- COMMIT this file; DO NOT APPLY it. The hub verifies BL-AVATAR-02.verify.sql in begin/rollback
-- then applies. (There is also 1 orphaned object to sweep — see the report / D-084.)

create policy "avatars_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and private.can_write_avatar(name));
