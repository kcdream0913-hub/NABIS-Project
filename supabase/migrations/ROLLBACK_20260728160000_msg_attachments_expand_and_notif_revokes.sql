-- Rollback BL-MSG-05 (D-053): restore the original message-attachments bucket config
-- and re-grant EXECUTE on the four notify functions.
--
-- The grants below name `public` so this is a TRUE inverse of the forward migration's
-- `revoke ... from public, anon, authenticated` — it restores the original ACL,
-- including the PUBLIC EXECUTE grant. That DELIBERATELY re-opens the inert lint-hygiene
-- advisor WARN; a rollback must reproduce prior state, WARN included.

update storage.buckets
set
  file_size_limit = 10485760,  -- 10 MB (original)
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
where id = 'message-attachments';

grant execute on function public.notify_post_reaction()          to public, anon, authenticated;
grant execute on function public.notify_post_comment()           to public, anon, authenticated;
grant execute on function public.notify_post_repost()            to public, anon, authenticated;
grant execute on function public.protect_notification_columns()  to public, anon, authenticated;
