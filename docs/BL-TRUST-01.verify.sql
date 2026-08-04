-- BL-TRUST-01.verify.sql — proves the verification gate. MUST RUN INSIDE ONE TRANSACTION,
-- with the migration applied earlier in the SAME open transaction:
--
--     begin;
--       \i docs/BL-TRUST-01.sql        -- or paste its body
--       \i docs/BL-TRUST-01.verify.sql -- or paste this body
--     rollback;                        -- nothing persists
--
-- SET LOCAL (below) requires the explicit transaction; run outside one and the role never
-- switches and every test passes for the wrong reason. Everything rolls back — no fixtures
-- persist. Runnable via psql or Supabase execute_sql (the whole begin..rollback as one call).
--
-- WHY the role spoof (D-039): a superuser / execute_sql session runs with RLS BYPASSED and
-- auth.uid() NULL, so an unspoofed insert proves nothing. Each case switches to the
-- `authenticated` role (so RLS actually applies) and sets request.jwt.claims.sub to the
-- fixture uid, attempts the insert inside a DO block that swallows ONLY insufficient_privilege
-- (42501 = the RLS violation) so the batch does not abort, then resets role and records the
-- outcome by ROW EXISTENCE. A non-RLS error (e.g. an FK 23503) is NOT swallowed — it aborts
-- loudly, so a mis-set fixture cannot masquerade as a pass.
--
-- Fixtures are REAL prod ids (read live 2026-08-04); repoint if the accounts change:
--   V 0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b  verified,   non-admin  (positive control)
--   U 236bd757-af85-4834-964f-257e0453aae3  unverified, non-admin  (must have a profile row — FK)
--   K 1258b010-291b-434c-a6a4-a1f6fee0d9b9  KC 1 — admin, UNVERIFIED (proves the admin branch)
--
-- D-058: every negative is bound to a POSITIVE signal — actual row existence (not a bare
-- zero-row select) — and paired with positive controls that MUST insert a row. `pass` is
-- computed from whether the attempted row is present, so a zero-row match cannot read as green.

create temp table _t(n int, label text, pass boolean, detail text) on commit drop;

-- ── 1. VERIFIED V CAN insert a post (positive control; P1 hosts the comment cases) ──────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b','role','authenticated')::text, true);
do $$ begin
  insert into public.posts (id, author_id, posted_as, body, view)
    values ('a1b2c3d4-0000-4000-8000-000000000001','0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b','user','bltrust verified post','us');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 1, 'verified CAN insert post',
  exists(select 1 from public.posts where id='a1b2c3d4-0000-4000-8000-000000000001'),
  case when exists(select 1 from public.posts where id='a1b2c3d4-0000-4000-8000-000000000001')
       then 'PASS: row present' else 'FAIL: RLS blocked a verified author' end;

-- ── 2. VERIFIED V CAN insert a comment on P1 (positive control) ─────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b','role','authenticated')::text, true);
do $$ begin
  insert into public.post_comments (id, post_id, author_id, body, body_lang)
    values ('a1b2c3d4-0000-4000-8000-000000000002','a1b2c3d4-0000-4000-8000-000000000001','0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b','bltrust verified comment','en');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 2, 'verified CAN insert comment',
  exists(select 1 from public.post_comments where id='a1b2c3d4-0000-4000-8000-000000000002'),
  case when exists(select 1 from public.post_comments where id='a1b2c3d4-0000-4000-8000-000000000002')
       then 'PASS: row present' else 'FAIL: RLS blocked a verified commenter' end;

-- ── 3. UNVERIFIED non-admin U CANNOT insert a post (negative) ───────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','236bd757-af85-4834-964f-257e0453aae3','role','authenticated')::text, true);
do $$ begin
  insert into public.posts (id, author_id, posted_as, body, view)
    values ('a1b2c3d4-0000-4000-8000-000000000003','236bd757-af85-4834-964f-257e0453aae3','user','bltrust unverified post attempt','us');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 3, 'unverified non-admin CANNOT insert post',
  not exists(select 1 from public.posts where id='a1b2c3d4-0000-4000-8000-000000000003'),
  'rows written by the blocked attempt: '||(select count(*) from public.posts where id='a1b2c3d4-0000-4000-8000-000000000003')||' (expect 0)';

-- ── 4. UNVERIFIED non-admin U CANNOT insert a comment (negative) ────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','236bd757-af85-4834-964f-257e0453aae3','role','authenticated')::text, true);
do $$ begin
  insert into public.post_comments (id, post_id, author_id, body, body_lang)
    values ('a1b2c3d4-0000-4000-8000-000000000004','a1b2c3d4-0000-4000-8000-000000000001','236bd757-af85-4834-964f-257e0453aae3','bltrust unverified comment attempt','en');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 4, 'unverified non-admin CANNOT insert comment',
  not exists(select 1 from public.post_comments where id='a1b2c3d4-0000-4000-8000-000000000004'),
  'rows written by the blocked attempt: '||(select count(*) from public.post_comments where id='a1b2c3d4-0000-4000-8000-000000000004')||' (expect 0)';

-- ── 5. ADMIN K (unverified) CAN insert a post — proves the admin branch ─────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','1258b010-291b-434c-a6a4-a1f6fee0d9b9','role','authenticated')::text, true);
do $$ begin
  insert into public.posts (id, author_id, posted_as, body, view)
    values ('a1b2c3d4-0000-4000-8000-000000000005','1258b010-291b-434c-a6a4-a1f6fee0d9b9','user','bltrust admin post','us');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 5, 'admin (unverified) CAN insert post',
  exists(select 1 from public.posts where id='a1b2c3d4-0000-4000-8000-000000000005'),
  case when exists(select 1 from public.posts where id='a1b2c3d4-0000-4000-8000-000000000005')
       then 'PASS: admin branch allowed it' else 'FAIL: admin branch did not apply — founder locked out' end;

-- ── 6. Ownership half NOT lost: verified V cannot post AS someone else (author_id = U) ───
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b','role','authenticated')::text, true);
do $$ begin
  insert into public.posts (id, author_id, posted_as, body, view)
    values ('a1b2c3d4-0000-4000-8000-000000000006','236bd757-af85-4834-964f-257e0453aae3','user','bltrust spoofed author','us');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 6, 'verified CANNOT insert post as another author',
  not exists(select 1 from public.posts where id='a1b2c3d4-0000-4000-8000-000000000006'),
  'rows written by the spoofed-author attempt: '||(select count(*) from public.posts where id='a1b2c3d4-0000-4000-8000-000000000006')||' (expect 0)';

-- ── 7. Scope NOT over-applied: unverified U CAN still react + bookmark on P1 ─────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','236bd757-af85-4834-964f-257e0453aae3','role','authenticated')::text, true);
do $$ begin
  insert into public.post_reactions (post_id, user_id, kind)
    values ('a1b2c3d4-0000-4000-8000-000000000001','236bd757-af85-4834-964f-257e0453aae3','like');
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.post_bookmarks (post_id, user_id)
    values ('a1b2c3d4-0000-4000-8000-000000000001','236bd757-af85-4834-964f-257e0453aae3');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 7, 'unverified CAN still react (scope not over-applied)',
  exists(select 1 from public.post_reactions where post_id='a1b2c3d4-0000-4000-8000-000000000001' and user_id='236bd757-af85-4834-964f-257e0453aae3'),
  case when exists(select 1 from public.post_reactions where post_id='a1b2c3d4-0000-4000-8000-000000000001' and user_id='236bd757-af85-4834-964f-257e0453aae3')
       then 'PASS: reaction allowed' else 'FAIL: reaction gated — scope over-applied' end;
insert into _t select 7, 'unverified CAN still bookmark (scope not over-applied)',
  exists(select 1 from public.post_bookmarks where post_id='a1b2c3d4-0000-4000-8000-000000000001' and user_id='236bd757-af85-4834-964f-257e0453aae3'),
  case when exists(select 1 from public.post_bookmarks where post_id='a1b2c3d4-0000-4000-8000-000000000001' and user_id='236bd757-af85-4834-964f-257e0453aae3')
       then 'PASS: bookmark allowed' else 'FAIL: bookmark gated — scope over-applied' end;

-- ── RESULT — every row must be pass = true; the summary must be all_passed = true ───────
select n, label, pass, detail from _t order by n, label;
select bool_and(pass) as all_passed, count(*) filter (where not pass) as failures from _t;
