-- END-STATE verification for 20260728160000_msg_attachments_expand_and_notif_revokes.
-- Run AFTER applying the migration (psql or the SQL editor). Every check RAISES on
-- mismatch, so a clean run means the migration's END STATE actually holds. This is
-- the BL-E2E-01 convention: a <migration>.verify.sql beside a migration asserts the
-- END STATE, not the diff. It also embodies D-058 — it does NOT `select ... = 0` (a
-- zero-row match is indistinguishable from a pass); it enumerates the exact objects
-- and raises if any is wrong, so a mistargeted query fails loudly instead of passing.

-- 1) Bucket config: 50MB, 11 allowed mime types, still private.
do $$
declare
  v_limit bigint;
  v_mimes text[];
  v_public boolean;
begin
  select file_size_limit, allowed_mime_types, public
    into v_limit, v_mimes, v_public
    from storage.buckets where id = 'message-attachments';

  if v_limit is null then
    raise exception 'bucket message-attachments not found (SELECT matched no row)';
  end if;
  if v_limit is distinct from 52428800 then
    raise exception 'file_size_limit = %, expected 52428800 (50MB)', v_limit;
  end if;
  if coalesce(array_length(v_mimes, 1), 0) <> 11 then
    raise exception 'allowed_mime_types has % entries, expected 11', coalesce(array_length(v_mimes, 1), 0);
  end if;
  if not ('video/mp4' = any(v_mimes) and 'image/gif' = any(v_mimes)
          and 'text/csv' = any(v_mimes) and 'text/plain' = any(v_mimes)) then
    raise exception 'allowed_mime_types missing an expected Phase-1 type: %', v_mimes;
  end if;
  if v_public is not false then
    raise exception 'bucket public = %, expected false (private)', v_public;
  end if;
end $$;

-- 2) The four BL-NOTIF-01 trigger fns: anon + authenticated must NOT hold EXECUTE.
--    D-057 — the effective grant was PUBLIC, so this is what actually had to change;
--    revoking only anon/authenticated would leave has_function_privilege = true.
do $$
declare
  v_fn text;
  v_role text;
begin
  foreach v_fn in array array[
    'public.notify_post_reaction()',
    'public.notify_post_comment()',
    'public.notify_post_repost()',
    'public.protect_notification_columns()'
  ] loop
    foreach v_role in array array['anon', 'authenticated'] loop
      if has_function_privilege(v_role, v_fn, 'EXECUTE') then
        raise exception 'REGRESSION: % still has EXECUTE on % (D-057)', v_role, v_fn;
      end if;
    end loop;
  end loop;
end $$;

select 'msg_attachments_expand_and_notif_revokes: END STATE VERIFIED' as result;
