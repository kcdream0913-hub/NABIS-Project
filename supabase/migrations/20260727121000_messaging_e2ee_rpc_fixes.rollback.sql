-- Rollback for 20260727121000_messaging_e2ee_rpc_fixes.sql — restores the
-- original (Phase 1) edit_message(uuid, text) and delete_message_for_everyone,
-- with no body_iv handling. Safe because today's data is all schema_version = 0.

-- restore edit_message(uuid, text): drop the 3-arg form, recreate the 2-arg one
drop function if exists public.edit_message(uuid, text, text);

create or replace function public.edit_message(p_id uuid, p_body text)
  returns void language plpgsql security definer set search_path to 'public' as $$
  declare m public.messages;
  begin
    select * into m from public.messages where id = p_id;
    if not found then raise exception 'message not found'; end if;
    if m.sender_id <> auth.uid() then raise exception 'not your message'; end if;
    if m.deleted_at is not null then raise exception 'message is deleted'; end if;
    if m.created_at < now() - interval '15 minutes' then raise exception 'edit window elapsed'; end if;
    if char_length(coalesce(btrim(p_body), '')) = 0 then raise exception 'empty body'; end if;
    update public.messages set body = p_body, edited_at = now() where id = p_id;
  end;
$$;
revoke all on function public.edit_message(uuid, text) from anon, public;
grant execute on function public.edit_message(uuid, text) to authenticated;

-- restore delete_message_for_everyone without the body_iv = null clause
create or replace function public.delete_message_for_everyone(p_id uuid)
  returns void language plpgsql security definer set search_path to 'public' as $$
  declare m public.messages;
  begin
    select * into m from public.messages where id = p_id;
    if not found then raise exception 'message not found'; end if;
    if m.sender_id <> auth.uid() then raise exception 'not your message'; end if;
    if m.deleted_at is not null then return; end if;
    if m.created_at < now() - interval '1 hour' then raise exception 'delete window elapsed'; end if;
    update public.messages
      set body = null, attachments = '[]'::jsonb, edited_at = null, deleted_at = now()
      where id = p_id;
    delete from public.message_reactions where message_id = p_id;
  end;
$$;
revoke all on function public.delete_message_for_everyone(uuid) from anon, public;
grant execute on function public.delete_message_for_everyone(uuid) to authenticated;
