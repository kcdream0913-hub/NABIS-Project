-- ROLLBACK for BL-AVATAR-01 — drops the 4 storage policies, the helper, and the bucket.
--
-- ORDER: drop the policies (they reference private.can_write_avatar) BEFORE the function.
-- The bucket delete requires the bucket be EMPTY (a storage.objects FK blocks it otherwise) —
-- inside the hub's begin/rollback verify no objects persist, so it is clean there; a real
-- post-adoption rollback must clear objects first.

drop policy if exists "avatars_select"      on storage.objects;
drop policy if exists "avatars_insert_own"   on storage.objects;
drop policy if exists "avatars_update_own"   on storage.objects;
drop policy if exists "avatars_delete_own"   on storage.objects;

drop function if exists private.can_write_avatar(text);

delete from storage.buckets where id = 'avatars';
