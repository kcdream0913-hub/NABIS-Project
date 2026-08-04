-- BL-TRUST-02.verify.sql — proves Task 1 (access_purchases INSERT policy dropped) + Task 2 (reports
-- intake trigger). Run INSIDE ONE TRANSACTION with the migration applied earlier in the SAME txn:
--     begin;
--       \i docs/BL-TRUST-02.sql
--       \i docs/BL-TRUST-02.verify.sql
--     rollback;                 -- nothing persists
--
-- D-039: a privileged session bypasses RLS + auth.uid() is null, so RLS behaviour is tested under
-- `set local role authenticated` + request.jwt.claims. D-058: every negative is bound to a POSITIVE
-- control (the server row exists; the report the member DID file exists; the admin update took), so
-- a zero-row / no-op can never read as a pass. Role-dependent results captured into txn-local GUCs.
--
-- Fixtures (real prod ids): M bba57fb8 (member, unverified non-admin) · K 1258b010 (admin) ·
-- P 849fb749 (a provider).

-- ═══ Task 1: access_purchases — the client INSERT path is gone ══════════════════════════════════
-- Positive control (privileged, RLS bypassed = the service_role/server payment path): a purchase
-- CAN still be written server-side → proves the table works, so the member's blocked insert below is
-- RLS denial, not a broken table. buyer = M so M can then read it (SELECT policy intact).
insert into public.access_purchases (id, buyer_user_id, provider_type, provider_id, amount, currency, status)
values ('00000000-0000-4000-8000-0000000000a1','bba57fb8-29c6-4081-bc63-9899f8c30132','user',
        '849fb749-3476-4865-8f6e-97a4011a1cff', 10, 'USD', 'paid');
select set_config('blt.t1_server', (select count(*) from public.access_purchases where id='00000000-0000-4000-8000-0000000000a1')::text, true);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bba57fb8-29c6-4081-bc63-9899f8c30132','role','authenticated')::text, true);
do $$ begin
  insert into public.access_purchases (buyer_user_id, provider_type, provider_id, amount, currency, status)
  values ('bba57fb8-29c6-4081-bc63-9899f8c30132','user','849fb749-3476-4865-8f6e-97a4011a1cff', 0, 'USD', 'paid');
  perform set_config('blt.t1_member','inserted',true);                        -- BAD if reached
exception when others then perform set_config('blt.t1_member','blocked:'||sqlstate,true); end $$;  -- 42501 = RLS
-- dropping INSERT did NOT break the read: M still SELECTs their own (server-written) row.
select set_config('blt.t1_read', (select count(*) from public.access_purchases where buyer_user_id='bba57fb8-29c6-4081-bc63-9899f8c30132')::text, true);
reset role;

-- ═══ Task 2: reports — intake trigger forces the server-owned columns ═══════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bba57fb8-29c6-4081-bc63-9899f8c30132','role','authenticated')::text, true);
-- forge: member files status='dismissed' with a forged reviewer_id — trigger must overwrite both.
insert into public.reports (id, target_type, target_id, reporter_id, reason, status, reviewer_id)
values ('00000000-0000-4000-8000-0000000000b1','post','00000000-0000-4000-8000-0000000000c1',
        'bba57fb8-29c6-4081-bc63-9899f8c30132','ATTACK pre-dismissed report','dismissed','1258b010-291b-434c-a6a4-a1f6fee0d9b9');
select set_config('blt.t2_status', (select status from public.reports where id='00000000-0000-4000-8000-0000000000b1'), true);        -- want open
select set_config('blt.t2_reviewer', (select coalesce(reviewer_id::text,'null') from public.reports where id='00000000-0000-4000-8000-0000000000b1'), true);  -- want null
select set_config('blt.t2_exists', (select count(*) from public.reports where id='00000000-0000-4000-8000-0000000000b1')::text, true);  -- want 1 (member CAN report)
-- legit ReportButton shape (4 cols, relies on defaults): also lands as open.
insert into public.reports (id, target_type, target_id, reporter_id, reason)
values ('00000000-0000-4000-8000-0000000000b2','post','00000000-0000-4000-8000-0000000000c1','bba57fb8-29c6-4081-bc63-9899f8c30132','legit report');
select set_config('blt.t2_legit', (select status from public.reports where id='00000000-0000-4000-8000-0000000000b2'), true);          -- want open
reset role;

-- regression: BEFORE INSERT only, so admin triage UPDATE still works.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','1258b010-291b-434c-a6a4-a1f6fee0d9b9','role','authenticated')::text, true);
do $$ begin
  update public.reports set status='dismissed' where id='00000000-0000-4000-8000-0000000000b1';
  if found then perform set_config('blt.t2_admin','updated',true); else perform set_config('blt.t2_admin','no-row',true); end if;
exception when others then perform set_config('blt.t2_admin','blocked:'||sqlstate,true); end $$;
select set_config('blt.t2_admin_status', (select status from public.reports where id='00000000-0000-4000-8000-0000000000b1'), true);   -- want dismissed
reset role;

-- ═══ result (privileged role): every pass must be true ═════════════════════════════════════════
select * from (values
  (1,'access_purchases: server (RLS-bypass) write still works',
     current_setting('blt.t1_server')::int = 1, 't1_server='||current_setting('blt.t1_server')||' (want 1)'),
  (2,'access_purchases: member client INSERT is now blocked (no policy)',
     current_setting('blt.t1_member') like 'blocked%', 't1_member='||current_setting('blt.t1_member')||' (want blocked, 42501=RLS)'),
  (3,'access_purchases: SELECT still works after dropping INSERT',
     current_setting('blt.t1_read')::int = 1, 't1_read='||current_setting('blt.t1_read')||' (want 1)'),
  (4,'reports: trigger forces status=open when dismissed is asserted',
     current_setting('blt.t2_status')='open', 't2_status='||current_setting('blt.t2_status')||' (want open)'),
  (5,'reports: trigger forces reviewer_id=null when one is forged',
     current_setting('blt.t2_reviewer')='null', 't2_reviewer='||current_setting('blt.t2_reviewer')||' (want null)'),
  (6,'reports: member CAN still file a report (positive control)',
     current_setting('blt.t2_exists')::int = 1, 't2_exists='||current_setting('blt.t2_exists')||' (want 1)'),
  (7,'reports: legit 4-column ReportButton insert lands as open',
     current_setting('blt.t2_legit')='open', 't2_legit='||current_setting('blt.t2_legit')||' (want open)'),
  (8,'reports: admin triage UPDATE open->dismissed still works (regression)',
     current_setting('blt.t2_admin')='updated' and current_setting('blt.t2_admin_status')='dismissed',
     't2_admin='||current_setting('blt.t2_admin')||' status='||current_setting('blt.t2_admin_status')||' (want updated/dismissed)')
) as t(n, label, pass, detail) order by n;
