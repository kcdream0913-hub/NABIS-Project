-- BL-EVENT-01 — event creation/editing/org-hosting + the host-FK account-deletion defect.
--
-- COMMIT this file, but DO NOT APPLY it: the hub verifies it in a begin/rollback against
-- prod, then applies. Statements are NOT wrapped in begin/commit here so the verifier can
-- wrap them; apply the whole file atomically (the migration runner wraps in a transaction).
--
-- Verified against prod dhnggnxwjgqvghbxelvw on 2026-07-30:
--   events = 5 rows, all with host_id + starts_at (0 null of each) → date/time are dead.
--   events_mode_check = mode in ('in_person','online'); events_view_check = view in
--   ('us','nepal','bridge'). events_host_id_fkey = NO ACTION (the defect). rsvps has 50
--   rows and rsvps_event_id_fkey is ON DELETE CASCADE.

-- 1. `status` — cancel-as-status, NEVER delete: rsvps_event_id_fkey is ON DELETE CASCADE,
--    so a hard delete of an event silently erases every attendee's RSVP. A cancelled event
--    keeps its RSVP rows and shows attendees a tombstone. `host_business_id` = the DISPLAY
--    identity of an org-hosted event; the accountable human stays `host_id` (same shape as
--    posts: posted_as + business_id). ON DELETE SET NULL so deleting the business leaves
--    the event (still owned by the human host) rather than vaporizing it.
alter table public.events
  add column status text not null default 'scheduled'
    check (status in ('scheduled','cancelled','postponed')),
  add column host_business_id uuid references public.businesses(id) on delete set null;

-- 2. Replace the insert policy so an org event's `host_business_id`, when set, must be a
--    business the caller OWNS. Ownership mirrors the offerings policies EXACTLY
--    (businesses.owner_user_id only, NOT business_members) — whether a non-owner member
--    may host on a business's behalf is a SEPARATE decision, deliberately not made here.
--    `(select auth.uid())` is the auth_rls_initplan-clean form (the old policy used bare
--    `auth.uid()`; this is a strict improvement, restored to bare form by the rollback).
drop policy events_insert_host on public.events;

create policy events_insert_host on public.events
  for insert to authenticated
  with check (
    host_id = (select auth.uid())
    and (host_business_id is null or exists (
      select 1 from public.businesses b
      where b.id = host_business_id and b.owner_user_id = (select auth.uid())))
  );

-- 3. The MISSING policies. `events` had SELECT (qual true) + INSERT only — no UPDATE, no
--    DELETE — so a host who typo'd the start time could never fix it and could never
--    cancel. Both host-scoped; the UPDATE with_check also pins host_id so a host can't
--    reassign the event to someone else.
create policy events_update_host on public.events
  for update to authenticated
  using      (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));

create policy events_delete_host on public.events
  for delete to authenticated
  using (host_id = (select auth.uid()));

-- 4. FK fix. events_host_id_fkey carried NO on-delete rule (NO ACTION), while
--    posts.author_id / rsvps.user_id / offerings.profile_id are all ON DELETE CASCADE. So
--    delete_own_account() → auth.users → profiles cascade hits this FK and fails 23503 for
--    ANY user who has ever hosted an event (proved by execution in begin/rollback against
--    prod), and breaks scripts/delete-test-accounts.mjs on the 5 seeded hosts.
--    CASCADE, not SET NULL: it matches the sibling FKs, and rsvps already cascades FROM
--    events, so a deleted host removes their events AND the attached RSVPs in one
--    consistent sweep. SET NULL was rejected — it needs host_id nullable, which weakens
--    every RLS policy keyed on host_id.
alter table public.events drop constraint events_host_id_fkey;
alter table public.events add constraint events_host_id_fkey
  foreign key (host_id) references public.profiles(id) on delete cascade;

-- Verification checklist for the hub (run inside begin/rollback):
--   (a) delete from auth.users where id = <a seeded event host> now SUCCEEDS, removing
--       that host's events and their rsvps (was 23503 before).
--   (b) row counts on events/rsvps for every OTHER host are unchanged.
--   (c) the four new/replaced policies behave under the D-039 JWT spoof (a non-host cannot
--       update/delete another host's event; an insert with a host_business_id the caller
--       does not own is rejected).
--
-- P1 follow-on (NOT in this migration): a `check (ends_at is null or ends_at > starts_at)`
-- constraint (validated client-side here), and capacity / RSVP states / cover media.
-- BROADER FINDING (see the task report): 7 OTHER NO-ACTION FKs into profiles also 23503-
-- block delete_own_account() — audit_logs.actor_id, business_members.added_by,
-- channels.owner_user_id, invites.from_user_id, reports.reporter_id, reports.reviewer_id,
-- verification_records.reviewer_id. Most want SET NULL (preserve the audit/moderation
-- record, anonymize the departed user), NOT CASCADE — a separate, considered sweep, not
-- folded in here because the correct rule differs per FK and some need nullable columns.
