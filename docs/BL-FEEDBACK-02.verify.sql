-- BL-FEEDBACK-02.verify.sql — RLS proofs for public.feedback. Run INSIDE ONE TRANSACTION with the
-- migration applied earlier in the SAME open txn:
--     begin;
--       \i docs/BL-FEEDBACK-02.sql
--       \i docs/BL-FEEDBACK-02.verify.sql
--     rollback;                 -- nothing persists
--
-- D-039: a privileged session bypasses RLS and auth.uid() is null, so every RLS test spoofs a
-- real member via `set local role authenticated` + request.jwt.claims. D-058: every negative is
-- bound to a POSITIVE control (the row that should exist does; the insert that should work did),
-- so a zero-row / no-op can never read as a pass. Role-dependent results are captured into
-- txn-local GUCs under each spoofed role, then assembled as the privileged role at the end.
--
-- Fixtures (real prod ids, read live 2026-08-04):
--   V 849fb749-3476-4865-8f6e-97a4011a1cff  — a VERIFIED, non-admin member
--   U bba57fb8-29c6-4081-bc63-9899f8c30132  — an UNVERIFIED, non-admin member
--   K 1258b010-291b-434c-a6a4-a1f6fee0d9b9  — KC, the sole admin (itself unverified)

-- Prod's Supabase default privileges grant `authenticated` access to a new public table; the
-- begin/rollback harness may not apply them, so grant explicitly here to isolate the RLS test from
-- a grant artifact. This mirrors what prod has via defaults — it is NOT part of the migration.
grant select, insert, update on public.feedback to authenticated;

-- Positive-control fixture: a feedback row OWNED BY V, created as the privileged role (RLS
-- bypassed). U must NOT see it (a3); V and admin MUST (a3 control / a5).
insert into public.feedback (id, user_id, kind, body)
values ('00000000-0000-4000-8000-00000000fb01', '849fb749-3476-4865-8f6e-97a4011a1cff', 'bug',
        'seed row owned by V — positive control for the select tests');

-- ── as V (verified member): a1 own-insert succeeds; a2 forged user_id blocked; a3 owner control ─
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','849fb749-3476-4865-8f6e-97a4011a1cff','role','authenticated')::text, true);
do $$ begin
  insert into public.feedback (user_id, kind, body)
  values ('849fb749-3476-4865-8f6e-97a4011a1cff','idea','a1 verified member inserting as themselves');
  perform set_config('blf.a1', 'inserted', true);
exception when others then perform set_config('blf.a1', 'blocked:'||sqlstate, true); end $$;
do $$ begin
  insert into public.feedback (user_id, kind, body)
  values ('bba57fb8-29c6-4081-bc63-9899f8c30132','bug','a2 forging another members user_id — must be blocked');
  perform set_config('blf.a2', 'inserted', true);                       -- BAD if reached
exception when others then perform set_config('blf.a2', 'blocked:'||sqlstate, true); end $$;  -- 42501 = RLS
select set_config('blf.a3_owner_sees',
  (select count(*) from public.feedback where id='00000000-0000-4000-8000-00000000fb01')::text, true);
reset role;

-- ── as U (unverified member): a4 CAN insert (no verification gate); a3 stranger cannot see V's row ─
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','bba57fb8-29c6-4081-bc63-9899f8c30132','role','authenticated')::text, true);
do $$ begin
  insert into public.feedback (user_id, kind, body)
  values ('bba57fb8-29c6-4081-bc63-9899f8c30132','confusing','a4 UNVERIFIED member — the gate is deliberately not applied');
  perform set_config('blf.a4', 'inserted', true);
exception when others then perform set_config('blf.a4', 'blocked:'||sqlstate, true); end $$;
select set_config('blf.a3_stranger_sees',
  (select count(*) from public.feedback where id='00000000-0000-4000-8000-00000000fb01')::text, true);
reset role;

-- ── as K (admin): a5 sees all + updates status ───────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','1258b010-291b-434c-a6a4-a1f6fee0d9b9','role','authenticated')::text, true);
select set_config('blf.a5_sees',
  (select count(*) from public.feedback where id='00000000-0000-4000-8000-00000000fb01')::text, true);
do $$ begin
  update public.feedback set status='triaged' where id='00000000-0000-4000-8000-00000000fb01';
  if found then perform set_config('blf.a5_update','updated',true);
  else perform set_config('blf.a5_update','no-row',true); end if;
exception when others then perform set_config('blf.a5_update','blocked:'||sqlstate,true); end $$;
select set_config('blf.a5_status',
  (select status from public.feedback where id='00000000-0000-4000-8000-00000000fb01'), true);
reset role;

-- ── result (privileged role): every `pass` must be true ──────────────────────────────────────
select * from (values
  (1,'verified member CAN insert own feedback',
     current_setting('blf.a1')='inserted',
     'a1='||current_setting('blf.a1')||' (want inserted)'),
  (2,'member CANNOT insert with another user_id (forged)',
     current_setting('blf.a2') like 'blocked%',
     'a2='||current_setting('blf.a2')||' (want blocked, 42501=RLS)'),
  (3,'stranger CANNOT read another member''s feedback (owner CAN — control)',
     current_setting('blf.a3_stranger_sees')::int = 0 and current_setting('blf.a3_owner_sees')::int = 1,
     'owner_sees='||current_setting('blf.a3_owner_sees')||' stranger_sees='||current_setting('blf.a3_stranger_sees')||' (want 1/0)'),
  (4,'UNVERIFIED member CAN insert (gate deliberately not applied)',
     current_setting('blf.a4')='inserted',
     'a4='||current_setting('blf.a4')||' (want inserted)'),
  (5,'admin CAN read all AND update status',
     current_setting('blf.a5_sees')::int = 1 and current_setting('blf.a5_update')='updated'
       and current_setting('blf.a5_status')='triaged',
     'admin_sees='||current_setting('blf.a5_sees')||' update='||current_setting('blf.a5_update')||' status='||current_setting('blf.a5_status'))
) as t(n, label, pass, detail)
order by n;
