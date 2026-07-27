-- Batch M-FIX §2 — E2EE-readiness fixes to the message-mutation RPCs.
-- Forward migration ONLY (hub applies via a branch). Additive/back-compatible for
-- today's data (all messages schema_version = 0 → plaintext path unchanged).

-- ── edit_message: carry a fresh IV for encrypted (schema_version = 1) messages ──
-- Adds an optional p_body_iv (defaults null so existing plaintext callers —
-- rpc('edit_message', {p_id, p_body}) — keep working). The old 2-arg signature is
-- dropped and replaced by the 3-arg form.
drop function if exists public.edit_message(uuid, text);

create or replace function public.edit_message(p_id uuid, p_body text, p_body_iv text default null)
  returns void language plpgsql security definer set search_path to 'public' as $$
  declare m public.messages;
  begin
    select * into m from public.messages where id = p_id;
    if not found then raise exception 'message not found'; end if;
    if m.sender_id <> auth.uid() then raise exception 'not your message'; end if;
    if m.deleted_at is not null then raise exception 'message is deleted'; end if;
    if m.created_at < now() - interval '15 minutes' then raise exception 'edit window elapsed'; end if;
    if char_length(coalesce(btrim(p_body), '')) = 0 then raise exception 'empty body'; end if;

    if m.schema_version = 1 then
      -- Encrypted message: body holds ciphertext, so a FRESH per-edit IV is
      -- mandatory. Reusing the previous IV under the same AES-GCM key is a
      -- catastrophic break (nonce reuse), so reject it explicitly.
      if p_body_iv is null or char_length(btrim(p_body_iv)) = 0 then
        raise exception 'encrypted edit requires body_iv';
      end if;
      if m.body_iv is not null and p_body_iv = m.body_iv then
        raise exception 'iv reuse forbidden';
      end if;
      update public.messages
        set body = p_body, body_iv = p_body_iv, edited_at = now()
        where id = p_id;
    else
      -- Plaintext message (schema_version = 0): an IV is meaningless and must not
      -- be supplied, so reject a non-null p_body_iv rather than silently storing it.
      if p_body_iv is not null then
        raise exception 'plaintext edit must not supply body_iv';
      end if;
      update public.messages
        set body = p_body, edited_at = now()
        where id = p_id;
    end if;
  end;
$$;
revoke all on function public.edit_message(uuid, text, text) from anon, public;
grant execute on function public.edit_message(uuid, text, text) to authenticated;

-- ── delete_message_for_everyone: also null body_iv when tombstoning ──
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
      set body = null, body_iv = null, attachments = '[]'::jsonb, edited_at = null, deleted_at = now()
      where id = p_id;
    delete from public.message_reactions where message_id = p_id;
  end;
$$;
revoke all on function public.delete_message_for_everyone(uuid) from anon, public;
grant execute on function public.delete_message_for_everyone(uuid) to authenticated;
