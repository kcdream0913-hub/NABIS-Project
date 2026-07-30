-- BL-ACCT-DELETE-FK — the 7 other NO-ACTION FKs into profiles that 23503-block
-- delete_own_account(), raised (not decided) in D-065's report finding (c).
--
-- COMMIT this file, but DO NOT APPLY it: the hub verifies it in a begin/rollback against
-- prod, then applies. Statements are not wrapped in begin/commit here so the verifier can
-- wrap them; apply the whole file atomically (the migration runner wraps in a transaction).
--
-- Verified against prod dhnggnxwjgqvghbxelvw on 2026-07-30 (hub, live query — not asserted):
--   All 7 target columns are already NULLABLE (no separate "make nullable" step needed).
--   All 7 currently confdeltype = 'a' (NO ACTION) — the defect, on every one.
--   All 7 reference profiles(id) (uniform target, confirmed via pg_constraint join, not
--   assumed).
--   Live row counts: audit_logs=0, invites=0, reports=0, business_members=1,
--   verification_records=31, channels=15 — the first three are empty, so this migration's
--   correctness for them rests on the constraint-level guarantee (confdeltype='n' is
--   deterministic Postgres behavior, not something that needs live data to prove) rather
--   than an executed cascade test.
--
-- SET NULL, not CASCADE, for all 7 — this is the opposite default from BL-EVENT-01
-- (events_host_id_fkey got CASCADE). The reason differs BY DESIGN, not by oversight:
-- these 7 are audit/moderation/attribution trails. Removing the ROW when the actor
-- deletes their account destroys the record of what happened (a report, a review
-- decision, an invite, a moderation action) — the record must survive; only the
-- attribution should anonymize. CASCADE was correct for events because an event's
-- attendees/RSVPs have no meaning without the event; that is not true of a report,
-- an audit log line, or a verification decision.
--
-- RLS re-checked for all 7 (pg_policies, read live, not assumed):
--   - reports_select_own (reporter_id = auth.uid()): a departed reporter can't query as
--     themselves regardless of this column's value — SET NULL changes nothing for them;
--     it only anonymizes what an admin (reports_admin_all) can still see.
--   - invites_select_related includes an OR branch keyed on business_id/owner_user_id
--     independent of from_user_id — an org invite stays visible to the business owner
--     after the original inviter's account is gone.
--   - business_members_write_owner and channels_select do not reference added_by /
--     owner_user_id at all — zero RLS impact.
--   - verification_records' policies key on subject_id/subject_type, never reviewer_id —
--     zero RLS impact.
--   None of the 7 policies assume their FK column is non-null. Safe.
--
-- NOT decided here, flagged for the coding agent to check before merge:
--   channels.owner_user_id is ALREADY NULL for all 15 live rows (verified live) — so the
--   "what does an orphaned channel mean" product question is currently moot in prod, but
--   grep any channel-rendering/settings code that might assume owner_user_id is non-null
--   and would crash/misbehave on null (e.g. an "edit channel" gate, an owner-only action).
--   If nothing dereferences it unguarded, no further change needed; if something does,
--   report it rather than deciding the product behavior here.
--
--   >>> CODING-AGENT CHECK RESOLVED (2026-07-30, bl-acct-delete-fk): CLEAN — no code
--   >>> selects or dereferences channels.owner_user_id. The only three channel reads are
--   >>> GlobalSearch.tsx (select id,slug,name), channels/page.tsx (select
--   >>> id,slug,name,description) and channels/[slug]/page.tsx (select
--   >>> id,slug,name,description,sector) — none request the column. There is NO channel
--   >>> edit/settings/create/owner-gate UI anywhere (the only member-created-channel
--   >>> reference is legal copy in app/[locale]/terms §10). SET NULL is safe; no further
--   >>> code change needed. The orphaned-channel product question stays deferred with the
--   >>> unbuilt channel-creation feature (D-017), not decided here.

alter table public.audit_logs drop constraint audit_logs_actor_id_fkey;
alter table public.audit_logs add constraint audit_logs_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;

alter table public.business_members drop constraint business_members_added_by_fkey;
alter table public.business_members add constraint business_members_added_by_fkey
  foreign key (added_by) references public.profiles(id) on delete set null;

alter table public.channels drop constraint channels_owner_user_id_fkey;
alter table public.channels add constraint channels_owner_user_id_fkey
  foreign key (owner_user_id) references public.profiles(id) on delete set null;

alter table public.invites drop constraint invites_from_user_id_fkey;
alter table public.invites add constraint invites_from_user_id_fkey
  foreign key (from_user_id) references public.profiles(id) on delete set null;

alter table public.reports drop constraint reports_reporter_id_fkey;
alter table public.reports add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles(id) on delete set null;

alter table public.reports drop constraint reports_reviewer_id_fkey;
alter table public.reports add constraint reports_reviewer_id_fkey
  foreign key (reviewer_id) references public.profiles(id) on delete set null;

alter table public.verification_records drop constraint verification_records_reviewer_id_fkey;
alter table public.verification_records add constraint verification_records_reviewer_id_fkey
  foreign key (reviewer_id) references public.profiles(id) on delete set null;

-- Verification checklist for the hub (run inside begin/rollback):
--   (a) delete from auth.users where id = <a profile referenced in business_members.added_by
--       or verification_records.reviewer_id> now SUCCEEDS; the referencing row SURVIVES
--       with the FK column set to null (not removed).
--   (b) row counts on all 7 tables are otherwise unchanged (no unrelated row disappeared).
--   (c) re-run get_advisors(security) after applying — a nullable FK to profiles is a
--       plausible new lint surface (e.g. "nullable column used in an RLS qual" style
--       warnings) even though the policy review above found no such qual.
--
-- Explicitly out of scope for this migration: channels currently has ONLY a SELECT
-- policy (qual true) — no INSERT/UPDATE/DELETE policy exists at all on public.channels.
-- Found during this review, unrelated to the FK defect. Not fixed here — flag it back
-- to the hub as a separate, unscoped finding; do not decide channel write-access design
-- as a side effect of this migration.
--
--   >>> CODING-AGENT CORROBORATION (2026-07-30): consistent at the code level — there is
--   >>> ZERO channel-write code in the app (no insert/update/delete against `channels`
--   >>> anywhere; only the three selects above). The absent write policies match an
--   >>> unbuilt feature, not a broken one. Raised to the hub as its own finding; not
--   >>> touched here.
