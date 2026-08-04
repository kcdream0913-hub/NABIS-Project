-- ROLLBACK for BL-AVATAR-02 — drops the scoped owner-only SELECT policy.
--
-- ⚠ Reverting this RE-BREAKS avatar deletion: with no SELECT policy the Storage API can no longer
-- resolve an object, so remove() no-ops again (the D-084 bug). Do not roll back unless the app is
-- simultaneously reverted to not rely on delete-on-replace / Remove-photo.

drop policy if exists "avatars_select_own" on storage.objects;
