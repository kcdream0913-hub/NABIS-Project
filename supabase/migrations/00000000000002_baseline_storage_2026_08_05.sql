-- 00000000000002_baseline_storage_2026_08_05.sql — the EXCLUDED-SCHEMA half of the baseline.
--
-- `supabase db dump` (file 00000000000001) excludes the `auth` and `storage` schemas, so it carries
-- NEITHER the 3 storage buckets + their 10 RLS policies NOR the auth.users trigger that creates a
-- profiles row on signup. `supabase db start` bootstraps the auth + storage SCHEMAS (tables +
-- Supabase-managed triggers) before migrations run, but NOT our objects inside them. This file
-- supplies exactly those, captured byte-for-byte from prod (dhnggnxwjgqvghbxelvw) 2026-08-05.
--
-- MUST run AFTER 00000000000001 (numeric order guarantees it): the storage policies reference
-- private.can_write_avatar / private.is_thread_participant, and the trigger references
-- public.handle_new_user — all created by file 1 (verified present in the dump). auth.users +
-- storage.objects/buckets come from the db-start bootstrap.
--
-- The buckets, the storage subset of `policies`, and `ext_triggers` in
-- supabase/migrations/BASELINE_FINGERPRINT.md all hash these objects — the restore must reproduce
-- them for the 10/10.

-- ── 3 buckets ────────────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152,
     array['image/jpeg','image/png','image/webp']),
  ('message-attachments', 'message-attachments', false, 52428800,
     array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm',
           'application/pdf',
           'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
           'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
           'text/csv','text/plain']),
  ('post-media', 'post-media', false, 52428800,
     array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm',
           'video/quicktime']);

-- ── 10 storage.objects RLS policies (exact qual / with_check from prod) ─────────────────────────────
-- avatars — owner-only writes; scoped SELECT so the Storage API's resolve-before-delete works (D-084)
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using ((bucket_id = 'avatars'::text) AND private.can_write_avatar(name));
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check ((bucket_id = 'avatars'::text) AND private.can_write_avatar(name));
create policy "avatars_select_own" on storage.objects for select to authenticated
  using ((bucket_id = 'avatars'::text) AND private.can_write_avatar(name));
create policy "avatars_update_own" on storage.objects for update to authenticated
  using ((bucket_id = 'avatars'::text) AND private.can_write_avatar(name))
  with check ((bucket_id = 'avatars'::text) AND private.can_write_avatar(name));

-- message-attachments — thread-participant scoped; path = {thread_id}/{uploader_id}/{file}
create policy "message_attach_delete" on storage.objects for delete to authenticated
  using ((bucket_id = 'message-attachments'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text));
create policy "message_attach_insert" on storage.objects for insert to authenticated
  with check ((bucket_id = 'message-attachments'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text) AND private.is_thread_participant((NULLIF((storage.foldername(name))[1], ''::text))::uuid));
create policy "message_attach_select" on storage.objects for select to authenticated
  using ((bucket_id = 'message-attachments'::text) AND private.is_thread_participant((NULLIF((storage.foldername(name))[1], ''::text))::uuid));

-- post-media — owner-only writes; readable by any authenticated member
create policy "post_media_delete_own" on storage.objects for delete to authenticated
  using ((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
create policy "post_media_insert_own" on storage.objects for insert to authenticated
  with check ((bucket_id = 'post-media'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
create policy "post_media_read" on storage.objects for select to authenticated
  using (bucket_id = 'post-media'::text);

-- ── the auth.users trigger the dump drops ──────────────────────────────────────────────────────────
-- THE most important line in this file: without it, a signup writes auth.users and NEVER creates the
-- profiles row — silently. The ext_triggers fingerprint part exists to catch its absence.
-- `create or replace trigger` is idempotent on re-apply.
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
