-- messages_last_read_at — applied to prod 2026-07-22 (version 20260722162053).
-- Captured retroactively from the live database (policy predicates from pg_policies,
-- function body from pg_get_functiondef), cross-checked against
-- ROLLBACK_messages_last_read_at.sql.
--
-- Per-participant read cursor powering unread state in the two-pane inbox.
-- Nullable: a participant who has never opened a thread has no cursor, and every
-- message reads as unread.

alter table public.direct_thread_participants
  add column if not exists last_read_at timestamptz;

comment on column public.direct_thread_participants.last_read_at is
  'Per-participant read cursor. Null = never opened; all messages unread.';

-- A participant may update ONLY their own row. Both USING and WITH CHECK are
-- required: USING selects which rows are updatable, WITH CHECK validates the
-- post-update row, so neither side can be used to move the cursor onto someone
-- else's participant row.
drop policy if exists dtp_update_own on public.direct_thread_participants;
create policy dtp_update_own on public.direct_thread_participants
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Defense in depth behind that policy: the UPDATE path exists solely to move
-- last_read_at, so the identity columns are pinned to their previous values.
-- Without this, a participant could rewrite thread_id/user_id on their own row
-- (the WITH CHECK above would still pass for user_id = auth.uid()) and graft
-- themselves onto another conversation.
create or replace function public.protect_dtp_identity()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.thread_id := old.thread_id;
  new.user_id   := old.user_id;
  return new;
end $function$;

drop trigger if exists trg_protect_dtp_identity on public.direct_thread_participants;
create trigger trg_protect_dtp_identity
  before update on public.direct_thread_participants
  for each row execute function public.protect_dtp_identity();
