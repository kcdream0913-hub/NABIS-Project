-- BridgeLink v3 — Security: remaining items (keep-but-scope RPCs + leaked-password note)
-- CISO, 2026-07-22. Idempotent. F1-F8 + DEFINER-exposure hardening already live
-- (migrations 20260721154427_rls_trust_hardening,
--             20260722095956_rls_definer_exposure_and_email_oracle_hardening).
-- This migration records the FINAL decisions for the two items that could not be removed.

-- =====================================================================
-- (1) LEAKED-PASSWORD PROTECTION — NOTE ONLY (Auth config, not SQL-settable)
-- =====================================================================
-- Supabase Auth "Prevent use of leaked passwords" (HaveIBeenPwned) is a GoTrue
-- Auth-service setting, not a database object, so it CANNOT be enabled from SQL/migration.
-- Status 2026-07-22: DISABLED. Gated behind the Supabase Pro plan; this org is on Free,
-- so the dashboard toggle does not persist.
-- ACTION (owner: KC): upgrade org to Pro, then enable at
--   Dashboard > Authentication > Attack Protection > "Prevent use of leaked passwords".
-- Interim Free-plan compensations (app/config layer, not this migration):
--   raise min password length 6 -> 8+, add strength requirements, prefer OAuth.
-- Tracked as a pre-public-signup go-live gate.

-- =====================================================================
-- (2) KEEP-BUT-SCOPE RPCs — re-assert least-privilege EXECUTE + annotate decision
-- =====================================================================
-- These are intended client RPCs and MUST stay SECURITY DEFINER + authenticated-callable
-- (they write across RLS). Advisor lint 0029 is permanent-by-design for them. The scope
-- boundary is enforced inside each function body; here we pin least-privilege and document.

revoke execute on function public.get_or_create_direct_thread(uuid) from public, anon;
grant  execute on function public.get_or_create_direct_thread(uuid) to authenticated, service_role;
comment on function public.get_or_create_direct_thread(uuid) is
  'KEEP-BUT-SCOPE (CISO 2026-07-22, D-009). Intended DM-start RPC. SECURITY DEFINER + authenticated-only by design; advisor lint 0029 is permanent-by-design. In-body scope: rejects null auth.uid(); forbids self-thread; target FK-bound to profiles; returns existing thread if present. Outstanding product-layer control: per-user rate limit + block-list (Task 1.2). Do NOT revoke without replacing the DM-start path.';

revoke execute on function public.redeem_business_invite(uuid) from public, anon;
grant  execute on function public.redeem_business_invite(uuid) to authenticated, service_role;
comment on function public.redeem_business_invite(uuid) is
  'KEEP-BUT-SCOPE (CISO 2026-07-22, D-009). Intended invite-redeem RPC. SECURITY DEFINER + authenticated-only by design; advisor lint 0029 is permanent-by-design. In-body scope: binds to caller email; requires pending + non-expired + owner-minted invite; idempotent membership insert. Do NOT revoke without replacing the invite-redeem path.';

-- =====================================================================
-- (3) F8 email->uid oracle — re-assert closed state (idempotent)
-- =====================================================================
revoke execute on function public.find_user_id_by_email(text) from public, anon, authenticated;
comment on function public.find_user_id_by_email(text) is
  'CLOSED F8 (CISO 2026-07-22). Email->uid oracle. EXECUTE = service_role only; anon + authenticated denied. Do NOT grant to anon/authenticated; if a server needs it, call with the service key.';
