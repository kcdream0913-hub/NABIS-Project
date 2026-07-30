-- BL-ADMIN-ACCOUNTS — admin-triggered account create/delete (D-068, account-
-- management half; the analytics half needs no schema change at all).
--
-- COMMIT this file, but DO NOT APPLY it: the hub verifies it in a begin/rollback
-- against prod, then applies. Statements are NOT wrapped in begin/commit here so
-- the verifier can wrap them; apply the whole file atomically.
--
-- Scope: two additions only.
--   1. admin_delete_account(uuid) — a SECURITY DEFINER RPC mirroring the
--      existing delete_own_account() (20260724150558_settings_preferences_
--      and_delete_account.sql), but admin-gated and TARGETED instead of
--      auth.uid()-only. Deleting the auth.users row cascades through every FK
--      D-065/D-066 already fixed this session: posts/events/rsvps/offerings/
--      businesses (owned) CASCADE; audit_logs/business_members/channels/
--      invites/reports/verification_records SET NULL. This migration adds NO
--      new cascade behavior — it reuses what D-065/D-066 already verified.
--      IMPORTANT, surfaced not hidden: deleting a professional who OWNS
--      businesses (businesses_owner_user_id_fkey is ON DELETE CASCADE, verified
--      live 2026-07-30) deletes those businesses too, and everything that
--      cascades from THEM (offerings, business_members, invites). The admin UI
--      must say this before confirming, not bury it — see
--      admin/accounts/page.tsx's confirm dialog.
--   2. businesses_admin_insert / businesses_admin_delete RLS policies — mirror
--      the shape of the EXISTING businesses_admin_update policy exactly
--      (same admin_users EXISTS check). Businesses currently have owner-only
--      insert/delete (businesses_insert_owner, businesses_delete_owner) and
--      admin-only update (businesses_admin_update) — insert/delete were
--      simply never extended to admins because there was no admin business-
--      creation flow before this PR.
--
-- Verified against prod dhnggnxwjgqvghbxelvw on 2026-07-30 (hub, live query):
--   admin_users has exactly 1 row (the only account that can ever pass this
--   check today). businesses.owner_user_id is NOT NULL with an existing
--   ON DELETE CASCADE to profiles(id) — confirmed via pg_constraint, not
--   assumed. No existing businesses_admin_insert/delete policy (grep of
--   00000000000000_baseline.sql's policy block — only admin_update exists).

create or replace function public.admin_delete_account(target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.admin_users where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;
  if target_user_id = auth.uid() then
    -- Force self-deletion through the existing, separately-audited
    -- delete_own_account() path — an admin deleting "themselves" through the
    -- admin tool is a different, riskier action (no independent confirmer)
    -- than the self-serve settings flow.
    raise exception 'use delete_own_account to delete your own account';
  end if;
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.admin_delete_account(uuid) from anon, public;
grant execute on function public.admin_delete_account(uuid) to authenticated;

create policy businesses_admin_insert on public.businesses
  for insert to authenticated
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy businesses_admin_delete on public.businesses
  for delete to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Verification checklist for the hub (run inside begin/rollback):
--   (a) as a non-admin authenticated user, `select public.admin_delete_account(<any uuid>)`
--       raises 'not authorized' (does NOT fall through to the delete).
--   (b) as the seeded admin, calling admin_delete_account(<own id>) raises the
--       self-delete guard message, NOT a generic error.
--   (c) as the seeded admin, admin_delete_account(<a disposable seeded test
--       account's id>) succeeds; confirm via a follow-up select that the
--       profiles/businesses/etc. rows behave EXACTLY as D-065/D-066's own
--       verification already proved (cascade vs set-null per table) — this
--       migration doesn't change that behavior, just who can trigger it.
--   (d) as a non-owner non-admin authenticated user, inserting/deleting a
--       businesses row NOT their own is still rejected (businesses_insert_owner/
--       businesses_delete_owner unchanged; the new admin policies are ADDITIVE
--       OR-branches, not replacements — Postgres RLS policies are OR'd).
--   (e) as the seeded admin, inserting a businesses row with an arbitrary
--       owner_user_id (an existing profile id) succeeds; deleting an existing
--       business succeeds and its business_members/invites/offerings rows are
--       gone afterward (their own CASCADE, unchanged by this migration).
