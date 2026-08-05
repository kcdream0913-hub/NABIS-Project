-- Messaging Phase 1: status ticks, reply, edit, delete (tombstone + per-user
-- hide), attachments, reactions. All additive / backward compatible.
--
-- Read tracking deliberately REUSES direct_thread_participants.last_read_at
-- (already present, RLS'd, group-ready via per-participant rows) instead of a
-- per-message reads table: a message is "seen" when every OTHER participant's
-- last_read_at >= the message's created_at. O(1) per thread, no row explosion.
-- Edit/delete windows are enforced in SECURITY DEFINER RPCs because messages has
-- no direct UPDATE/DELETE policy — the RPC is the only mutation path, so the
-- window cannot be bypassed with raw SQL.

-- ── messages: reply / edit / delete-tombstone / attachments / E2EE forward-compat ──
alter table public.messages
  add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null,
  add column if not exists edited_at      timestamptz,
  add column if not exists deleted_at     timestamptz,
  add column if not exists attachments    jsonb not null default '[]'::jsonb,
  add column if not exists schema_version smallint not null default 0;

-- A tombstone nulls the body server-side, so body must become nullable.
alter table public.messages alter column body drop not null;

create index if not exists idx_messages_reply_to on public.messages(reply_to_message_id);
-- (thread_id, created_at) is already covered by the pre-existing
-- messages_thread_id_created_at_idx — no duplicate index here.

-- ── helper: can the current user access a given message? (thread participant / channel member) ──
create or replace function private.can_access_message(p_message_id uuid)
  returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.messages m
    where m.id = p_message_id
      and (
        (m.thread_id is not null and private.is_thread_participant(m.thread_id))
        or (m.channel_id is not null and exists (
          select 1 from public.channel_memberships cm
          where cm.channel_id = m.channel_id and cm.user_id = auth.uid()))
      )
  );
$$;

-- ── reply integrity: a reply must target a message in the SAME conversation ──
create or replace function public.enforce_reply_integrity()
  returns trigger language plpgsql security definer set search_path to 'public' as $$
  declare r public.messages;
  begin
    if new.reply_to_message_id is not null then
      select * into r from public.messages where id = new.reply_to_message_id;
      if not found then
        new.reply_to_message_id := null;
      elsif new.thread_id is distinct from r.thread_id
         or new.channel_id is distinct from r.channel_id then
        raise exception 'reply target belongs to a different conversation';
      end if;
    end if;
    return new;
  end;
$$;
drop trigger if exists trg_enforce_reply_integrity on public.messages;
create trigger trg_enforce_reply_integrity
  before insert on public.messages
  for each row execute function public.enforce_reply_integrity();
-- Trigger-only function: it must NOT be callable as a PostgREST RPC. Trigger
-- execution does not check EXECUTE privilege, so revoking is safe.
revoke all on function public.enforce_reply_integrity() from anon, authenticated, public;

-- ── reactions: one per (message,user), participant-scoped, realtime ──
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id)     on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 32),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists idx_message_reactions_user on public.message_reactions(user_id);
alter table public.message_reactions enable row level security;

create policy message_reactions_select on public.message_reactions
  for select to authenticated using (private.can_access_message(message_id));
create policy message_reactions_insert_own on public.message_reactions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_access_message(message_id));
create policy message_reactions_update_own on public.message_reactions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy message_reactions_delete_own on public.message_reactions
  for delete to authenticated using (user_id = (select auth.uid()));

-- ── per-user hide (delete-for-me) ──
create table if not exists public.message_hides (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references auth.users(id)     on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists idx_message_hides_user on public.message_hides(user_id);
alter table public.message_hides enable row level security;
create policy message_hides_all_own on public.message_hides
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── edit within 15 min (own, text only) ──
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

-- ── delete-for-everyone within 1 hour (own): tombstone, null content, drop reactions ──
-- Storage objects are removed by the client (uploader has a DELETE policy) before
-- calling this; the RPC owns the DB-side tombstone only.
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

-- ── realtime: reactions + read cursor (messages is already published) ──
alter table public.message_reactions replica identity full;  -- DELETE payload carries emoji/user
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.direct_thread_participants;

-- ── storage: private attachments bucket; object path = {thread_id}/{uploader_id}/{name} ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-attachments','message-attachments', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create policy "message_attach_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[2] = auth.uid()::text
    and private.is_thread_participant(nullif((storage.foldername(name))[1], '')::uuid)
  );
create policy "message_attach_select" on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and private.is_thread_participant(nullif((storage.foldername(name))[1], '')::uuid)
  );
create policy "message_attach_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
