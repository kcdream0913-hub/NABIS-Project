-- BL-TRUST-02 — close the last two live column-blind-write instances (D-088).
--
-- Column-blind write policy = a policy that checks WHO is writing but not WHAT they write. This is
-- the most frequent defect class in the codebase — F2 (business self-verify), F5 (R&D self-approve),
-- posts_update_own, post_comments_update_own, and the two below (6). This migration closes the last
-- two live instances; the standing lint (supabase/lint/column_blind_writes.sql) stops a seventh.
--
-- ✅ APPLIED TO PROD 2026-08-04 by the hub as migration `bl_trust_02_close_column_blind_writes`
--   (verified 8/8 in begin/rollback FIRST). Do NOT re-apply; this file stays the canonical source.
--   Prod counts: policies 98→97, functions 24→25, triggers 16→17, access_purchases policies 2→1.
--   Advisor: 6 pre-existing DEFINER WARN, zero new. The apply bumped 3 BASELINE_FINGERPRINT hashes
--   (functions / policies / triggers — exactly what it touches); re-captured + committed with it.

-- ── Task 1: access_purchases — DROP the client INSERT policy (do NOT sanitise it) ──────────────
-- A purchase is a SERVER-SIDE fact. The ONLY client reference is a SELECT (contact-business.tsx:36,
-- the paid-provider gate read); no client code inserts a purchase and none ever should. So the fix
-- is to remove the capability, not to sanitise the row: `service_role` bypasses RLS, so whatever
-- real payment flow arrives later writes purchases server-side and is unaffected. The SELECT policy
-- (access_purchases_select_own) STAYS, so the gate query still reads. (The hub first proposed an
-- intake trigger here; dropping the policy is better because there is no client insert path to
-- preserve — removing a capability beats sanitising one.)
drop policy access_purchases_insert_own on public.access_purchases;

-- ── Task 2: reports — intake trigger forcing the server-owned columns ───────────────────────────
-- reports_insert_own checks only reporter_id, and the table carries status + reviewer_id, so a
-- member could file a report already status='dismissed' with a forged reviewer_id (never seen by an
-- admin, invisible to the `status='open'` queue count). Same protect_feedback_intake shape:
-- SECURITY INVOKER (no DEFINER surface), BEFORE INSERT only so the admin dashboard's
-- `update reports set status=...` triage path is untouched. Overwrite, never raise: the columns are
-- server-owned with sane defaults, and ReportButton only ever sends target_type/target_id/
-- reporter_id/reason (it relies on the defaults), so this breaks no legitimate insert.
create or replace function public.protect_report_intake()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  new.status      := 'open';   -- a reporter cannot pre-dismiss their own report
  new.reviewer_id := null;     -- nor attribute it to a reviewer who never saw it
  new.created_at  := now();
  return new;
end $$;

create trigger trg_protect_report_intake
  before insert on public.reports
  for each row execute function public.protect_report_intake();
