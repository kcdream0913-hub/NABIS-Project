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
-- intake-trigger proofs (findings 1+2): U asserts status='closed' AND a backdated created_at;
-- protect_feedback_intake must OVERWRITE both. D-058: assert the STORED value, not row absence —
-- the insert SUCCEEDS, what changes is what lands.
insert into public.feedback (id, user_id, kind, body, status, created_at)
values ('00000000-0000-4000-8000-00000000fb02','bba57fb8-29c6-4081-bc63-9899f8c30132','bug',
        'ATTACK asserting status=closed + created_at=1970 — the trigger must overwrite both','closed','1970-01-01T00:00:00Z');
select set_config('blf.t6_status',
  (select status from public.feedback where id='00000000-0000-4000-8000-00000000fb02'), true);
select set_config('blf.t7_recent',
  (select (created_at > now() - interval '1 minute')::text from public.feedback where id='00000000-0000-4000-8000-00000000fb02'), true);
-- finding 1 (rate-limit visibility): NONE of U's rows may escape the 1-hour window (a4 + attack = 2).
select set_config('blf.t8_total',
  (select count(*) from public.feedback where user_id='bba57fb8-29c6-4081-bc63-9899f8c30132')::text, true);
select set_config('blf.t8_inwindow',
  (select count(*) from public.feedback where user_id='bba57fb8-29c6-4081-bc63-9899f8c30132' and created_at >= now() - interval '1 hour')::text, true);
select set_config('blf.a3_stranger_sees',
  (select count(*) from public.feedback where id='00000000-0000-4000-8000-00000000fb01')::text, true);
-- length-bound proof (hub round 3): text columns carry CHECK caps. A realistic ~253-char in-app UA
-- + ne + a 40-char SHA inserts AND reads back full; a 2 MB user_agent raises 23514 and adds NO row.
-- D-058: assert the SURVIVING row (count), not the absent one — U now has a4 + attack + this = 3.
insert into public.feedback (id, user_id, kind, body, user_agent, locale, app_version)
values ('00000000-0000-4000-8000-00000000fb03','bba57fb8-29c6-4081-bc63-9899f8c30132','idea','realistic long-UA insert control',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/456.0.0.34.109;FBBV/577645170;FBDV/iPhone14,3;FBMD/iPhone;FBSN/iOS;FBSV/17.4.1;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5;FBRV/580524205]',
  'ne','1234567890abcdef1234567890abcdef12345678');
select set_config('blf.t9_ua_len',
  (select char_length(user_agent)::text from public.feedback where id='00000000-0000-4000-8000-00000000fb03'), true);
do $$ begin
  insert into public.feedback (user_id, kind, body, user_agent)
  values ('bba57fb8-29c6-4081-bc63-9899f8c30132','bug','2MB user_agent abuse', repeat('x', 2*1024*1024));
  perform set_config('blf.t9_abuse','inserted',true);                                  -- BAD if reached
exception when others then perform set_config('blf.t9_abuse','blocked:'||sqlstate,true); end $$;  -- 23514 = CHECK
select set_config('blf.t9_count',
  (select count(*) from public.feedback where user_id='bba57fb8-29c6-4081-bc63-9899f8c30132')::text, true);
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
  (5,'admin reads all AND triages new->triaged (regression: trigger is BEFORE INSERT only)',
     current_setting('blf.a5_sees')::int = 1 and current_setting('blf.a5_update')='updated'
       and current_setting('blf.a5_status')='triaged',
     'admin_sees='||current_setting('blf.a5_sees')||' update='||current_setting('blf.a5_update')||' status='||current_setting('blf.a5_status')),
  (6,'intake trigger forces status=new when status=closed is asserted',
     current_setting('blf.t6_status')='new',
     't6_status='||current_setting('blf.t6_status')||' (want new)'),
  (7,'intake trigger forces created_at=now when a backdate is asserted',
     current_setting('blf.t7_recent')='true',
     't7_recent='||current_setting('blf.t7_recent')||' (want true)'),
  (8,'rate limiter sees ALL of a member''s rows (none backdated out of window)',
     current_setting('blf.t8_inwindow')::int = current_setting('blf.t8_total')::int
       and current_setting('blf.t8_total')::int >= 2,
     'inwindow='||current_setting('blf.t8_inwindow')||' total='||current_setting('blf.t8_total')||' (want equal, >=2)'),
  (9,'realistic long UA inserts + reads back; 2MB UA rejected 23514, count unchanged',
     current_setting('blf.t9_ua_len')::int >= 200 and current_setting('blf.t9_abuse') like 'blocked%'
       and current_setting('blf.t9_count')::int = 3,
     'ua_len='||current_setting('blf.t9_ua_len')||' abuse='||current_setting('blf.t9_abuse')||' count='||current_setting('blf.t9_count')||' (want >=200 / blocked / 3)')
) as t(n, label, pass, detail)
order by n;
