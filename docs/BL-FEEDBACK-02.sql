-- BL-FEEDBACK-02 — in-product pilot feedback capture (platform feedback to the operator).
--
-- WHY a table and not a better mailto: a mailto: fails SILENTLY for any user without a
-- configured desktop mail client (a meaningful fraction on mobile / webmail). Tolerable for a
-- marketing contact link; NOT tolerable for the single channel carrying the only signal that
-- tells KC whether the pilot is working. So: a real table, with a real success/error state.
-- The mailto stays as a visible SECONDARY option (see settings/support/page.tsx).
--
-- ⚠ NOT gated on private.can_write_content() (D-082), DELIBERATELY. D-082 gates BROADCAST
--   content (posts / comments / quote-reposts) that reaches every member's feed. Feedback is a
--   PRIVATE 1:1 channel to the operator, and the members most likely to be blocked by a
--   verification gate — unverified members stuck in onboarding — are EXACTLY the ones whose
--   feedback is most valuable. Same reasoning as the D-083 avatar decision (own-profile / private
--   action, no new reach). Do NOT "harmonise" this by adding a gate. verify.sql proves an
--   unverified member CAN insert.
--
-- ⚠ user_id is `on delete set null`, DELIBERATELY — matching the 7 FKs converted in
--   bl_acct_delete_fk_set_null_7_profiles_fks (D-066). A member deleting their account must NOT
--   erase the bug report that told KC the delete flow was broken. Only the attribution
--   anonymises; the record survives. CONFIRMED: `delete_own_account()` (D-022) needs NO matching
--   change — it deletes the auth.users row and this FK's ON DELETE SET NULL handles the feedback
--   rows automatically (same as audit_logs.actor_id etc.).
--
-- COMMIT this file; DO NOT APPLY it. The hub verifies BL-FEEDBACK-02.verify.sql in a
-- begin/rollback against prod, then applies.

create table public.feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  kind         text not null check (kind in ('bug','idea','confusing','other')),
  body         text not null check (char_length(btrim(body)) between 10 and 4000),
  page_path    text,
  locale       text,
  user_agent   text,
  app_version  text,
  status       text not null default 'new' check (status in ('new','triaged','closed')),
  created_at   timestamptz not null default now()
);

-- Admin list: newest-first within a status bucket (the queue view groups by status).
create index feedback_status_created_idx on public.feedback (status, created_at desc);
-- FK-covering + rate-limit index (NOT in the original draft — keeps the performance advisor's
-- `unindexed_foreign_keys` clean, and the 5/hr rate-limit query filters user_id + created_at).
create index feedback_user_created_idx on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;

-- INSERT — a member may only file feedback AS THEMSELVES. `(select auth.uid())`, never bare,
-- so no auth_rls_initplan WARN. No verification gate (see header). Server-only fields
-- (user_id, locale, user_agent, app_version) are set by the server action, never client-asserted.
create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- SELECT — your own feedback, or everything if you are an admin. This table WILL contain
-- complaints about other members, so a cross-member leak here is worse than the usual: the
-- `own OR is_admin()` shape is load-bearing, and verify.sql proves a member cannot read another's.
create policy feedback_select_own_or_admin on public.feedback
  for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());

-- UPDATE — admins only, for status triage (new -> triaged -> closed). No member update path.
create policy feedback_update_admin on public.feedback
  for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

-- DELETE — NO policy on purpose. Feedback is an append-only record; RLS therefore denies every
-- client delete. Removal, if ever needed, is a service-role / dashboard action.
