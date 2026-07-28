-- BL-MSG-05 (D-053) — expand the DM attachment bucket for the WhatsApp-style
-- attachment sheet, and land the four pending BL-NOTIF-01 SECURITY DEFINER revokes.
--
-- Finding that corrected the spec: the `message-attachments` bucket was 10MB with an
-- image/pdf/docx/xlsx-only Content-Type allowlist, which PHYSICALLY REJECTED
-- video/gif/csv/txt uploads — so "Photos & videos" + csv/txt were impossible without
-- this change. Raise the cap to 50MB (video is duration-capped to <=90s and images
-- stay capped smaller client-side) and expand the allowlist to the Phase-1 set.
--
-- The Content-Type allowlist is only a COARSE, client-controlled first filter; the
-- real type boundary is the server-side MAGIC-BYTE sniff on the read route (D-052),
-- which cannot be forged. Storage RLS is UNCHANGED — already participant-scoped via
-- message_attach_select/insert/delete on private.is_thread_participant.

update storage.buckets
set
  file_size_limit = 52428800,  -- 50 MB
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'text/plain'
  ]
where id = 'message-attachments';

-- ── BL-NOTIF-01 deferred hygiene (notif-trigger-fn-revoke-pending.md) ──────────────
-- The four SECURITY DEFINER trigger functions still hold the default EXECUTE grant
-- for anon + authenticated. The hub verified this is INERT (a direct call raises
-- "trigger functions can only be called as triggers"), so it is lint hygiene, not a
-- vulnerability — bundled here per the note ("do not cut a migration just for this").
revoke execute on function public.notify_post_reaction()          from anon, authenticated;
revoke execute on function public.notify_post_comment()           from anon, authenticated;
revoke execute on function public.notify_post_repost()            from anon, authenticated;
revoke execute on function public.protect_notification_columns()  from anon, authenticated;
