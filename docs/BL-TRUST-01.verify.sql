-- BL-TRUST-01.verify.sql (v2) — proves the verification gate AND that it does not over-reach.
-- MUST RUN INSIDE ONE TRANSACTION, with the migration applied earlier in the SAME open txn:
--
--     begin;
--       \i docs/BL-TRUST-01.sql        -- or paste its body
--       \i docs/BL-TRUST-01.verify.sql -- or paste this body
--     rollback;                        -- nothing persists
--
-- SET LOCAL below requires the explicit transaction; run outside one and the role never
-- switches and every test passes for the wrong reason. Everything rolls back.
--
-- WHY the role spoof (D-039): a superuser / execute_sql session runs with RLS BYPASSED and
-- auth.uid() NULL, so an unspoofed insert proves nothing. Each case switches to `authenticated`
-- and sets request.jwt.claims.sub, attempts the action inside a DO block that swallows ONLY
-- insufficient_privilege (42501 — the RLS/guard denial) so the batch does not abort, then
-- resets role and records the outcome by ROW/VALUE state. A non-42501 error is NOT swallowed —
-- it aborts loudly.
--
-- HARNESS NOTE (the hub hit this): fixtures for the UPDATE/mutation cases are created below as
-- the PRIVILEGED session role — i.e. WITHOUT switching to authenticated — so RLS is bypassed
-- and the now-applied INSERT gate does not block them. Creating them as the spoofed
-- authenticated role fails post-migration and aborts the whole transaction.
--
-- Fixtures are REAL prod ids (read live 2026-08-04); repoint if the accounts change:
--   V 0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b  verified,   non-admin
--   U 236bd757-af85-4834-964f-257e0453aae3  unverified, non-admin  (must have a profile row — FK)
--   K 1258b010-291b-434c-a6a4-a1f6fee0d9b9  KC 1 — admin, UNVERIFIED (proves the admin branch)
--
-- D-058: every negative is bound to a POSITIVE signal — actual row existence or the actual
-- stored body VALUE (not a bare zero-row select) — paired with positive controls that MUST act.

create temp table _t(n int, label text, pass boolean, detail text) on commit drop;

-- ═══ INSERT gate (cases 1–7) ════════════════════════════════════════════════════════════════

-- 1. VERIFIED V CAN insert a post (positive control; P1 hosts the comment cases).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b','role','authenticated')::text, true);
do $$ begin
  insert into public.posts (id, author_id, posted_as, body, view)
    values ('a1b2c3d4-0000-4000-8000-000000000001','0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b','user','bltrust verified post','us');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 1, 'verified CAN insert post',
  exists(select 1 from public.posts where id='a1b2c3d4-0000-4000-8000-000000000001'),
  'row present = '||exists(select 1 from public.posts where id='a1b2c3d4-0000-4000-8000-000000000001')::text;

-- 2. VERIFIED V CAN insert a comment on P1.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b','role','authenticated')::text, true);
do $$ begin
  insert into public.post_comments (id, post_id, author_id, body, body_lang)
    values ('a1b2c3d4-0000-4000-8000-000000000002','a1b2c3d4-0000-4000-8000-000000000001','0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b','bltrust verified comment','en');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 2, 'verified CAN insert comment',
  exists(select 1 from public.post_comments where id='a1b2c3d4-0000-4000-8000-000000000002'),
  'row present = '||exists(select 1 from public.post_comments where id='a1b2c3d4-0000-4000-8000-000000000002')::text;

-- 3. UNVERIFIED non-admin U CANNOT insert a post.
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

-- 4. UNVERIFIED non-admin U CANNOT insert a comment.
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

-- 5. ADMIN K (unverified) CAN insert a post — admin branch.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','1258b010-291b-434c-a6a4-a1f6fee0d9b9','role','authenticated')::text, true);
do $$ begin
  insert into public.posts (id, author_id, posted_as, body, view)
    values ('a1b2c3d4-0000-4000-8000-000000000005','1258b010-291b-434c-a6a4-a1f6fee0d9b9','user','bltrust admin post','us');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 5, 'admin (unverified) CAN insert post',
  exists(select 1 from public.posts where id='a1b2c3d4-0000-4000-8000-000000000005'),
  'row present = '||exists(select 1 from public.posts where id='a1b2c3d4-0000-4000-8000-000000000005')::text;

-- 6. Ownership half NOT lost: verified V cannot post AS someone else (author_id = U).
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

-- 7. Scope NOT over-applied: unverified U CAN still react + bookmark on P1.
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
  'reaction present = '||exists(select 1 from public.post_reactions where post_id='a1b2c3d4-0000-4000-8000-000000000001' and user_id='236bd757-af85-4834-964f-257e0453aae3')::text;
insert into _t select 7, 'unverified CAN still bookmark (scope not over-applied)',
  exists(select 1 from public.post_bookmarks where post_id='a1b2c3d4-0000-4000-8000-000000000001' and user_id='236bd757-af85-4834-964f-257e0453aae3'),
  'bookmark present = '||exists(select 1 from public.post_bookmarks where post_id='a1b2c3d4-0000-4000-8000-000000000001' and user_id='236bd757-af85-4834-964f-257e0453aae3')::text;

-- ═══ MUTATION / QUOTE-REPOST gate (cases 8–14) — the hub's adversarial findings ═════════════
--
-- Fixtures created as the PRIVILEGED session role (RLS bypassed) so the applied INSERT gate
-- does not block them (see HARNESS NOTE). P_u/C_u* owned by U (unverified), P_k by K (admin),
-- P_t by V (a repost target).
insert into public.posts (id, author_id, posted_as, body, view) values
  ('a1b2c3d4-0000-4000-8000-0000000000f1','236bd757-af85-4834-964f-257e0453aae3','user','u post original','us'),
  ('a1b2c3d4-0000-4000-8000-0000000000f4','1258b010-291b-434c-a6a4-a1f6fee0d9b9','user','k post original','us'),
  ('a1b2c3d4-0000-4000-8000-0000000000f5','0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b','user','repost target','us');
insert into public.post_comments (id, post_id, author_id, body, body_lang) values
  ('a1b2c3d4-0000-4000-8000-0000000000f2','a1b2c3d4-0000-4000-8000-0000000000f1','236bd757-af85-4834-964f-257e0453aae3','u comment edit-target','en'),
  ('a1b2c3d4-0000-4000-8000-0000000000f3','a1b2c3d4-0000-4000-8000-0000000000f1','236bd757-af85-4834-964f-257e0453aae3','u comment delete-target','en');

-- 8. UNVERIFIED U CANNOT publish a QUOTE-repost (finding #1). Run BEFORE case 9 so the blocked
--    attempt leaves the (P_t,U) PK free for the bare repost.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','236bd757-af85-4834-964f-257e0453aae3','role','authenticated')::text, true);
do $$ begin
  insert into public.post_reposts (post_id, user_id, view, quote)
    values ('a1b2c3d4-0000-4000-8000-0000000000f5','236bd757-af85-4834-964f-257e0453aae3','us','BUY CHEAP VISAS — spam from unverified');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 8, 'unverified CANNOT quote-repost',
  not exists(select 1 from public.post_reposts where post_id='a1b2c3d4-0000-4000-8000-0000000000f5' and user_id='236bd757-af85-4834-964f-257e0453aae3'),
  'quote-repost rows by U: '||(select count(*) from public.post_reposts where post_id='a1b2c3d4-0000-4000-8000-0000000000f5' and user_id='236bd757-af85-4834-964f-257e0453aae3')||' (expect 0)';

-- 9. UNVERIFIED U CAN still bare-repost (quote null) — scope not over-applied.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','236bd757-af85-4834-964f-257e0453aae3','role','authenticated')::text, true);
do $$ begin
  insert into public.post_reposts (post_id, user_id, view)
    values ('a1b2c3d4-0000-4000-8000-0000000000f5','236bd757-af85-4834-964f-257e0453aae3','us');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 9, 'unverified CAN bare-repost (scope not over-applied)',
  exists(select 1 from public.post_reposts where post_id='a1b2c3d4-0000-4000-8000-0000000000f5' and user_id='236bd757-af85-4834-964f-257e0453aae3' and quote is null),
  'bare repost present = '||exists(select 1 from public.post_reposts where post_id='a1b2c3d4-0000-4000-8000-0000000000f5' and user_id='236bd757-af85-4834-964f-257e0453aae3' and quote is null)::text;

-- 10. UNVERIFIED U CANNOT rewrite an existing POST body (finding #2). Bind to the stored value.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','236bd757-af85-4834-964f-257e0453aae3','role','authenticated')::text, true);
do $$ begin
  update public.posts set body='EDITED INTO SPAM' where id='a1b2c3d4-0000-4000-8000-0000000000f1';
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 10, 'unverified CANNOT edit post body',
  (select body from public.posts where id='a1b2c3d4-0000-4000-8000-0000000000f1') = 'u post original',
  'P_u.body = '||coalesce((select body from public.posts where id='a1b2c3d4-0000-4000-8000-0000000000f1'),'<null>')||' (expect "u post original")';

-- 11. UNVERIFIED U CANNOT rewrite an existing COMMENT body (finding #3).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','236bd757-af85-4834-964f-257e0453aae3','role','authenticated')::text, true);
do $$ begin
  update public.post_comments set body='EDITED INTO SPAM' where id='a1b2c3d4-0000-4000-8000-0000000000f2';
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 11, 'unverified CANNOT edit comment body',
  (select body from public.post_comments where id='a1b2c3d4-0000-4000-8000-0000000000f2') = 'u comment edit-target',
  'C_u1.body = '||coalesce((select body from public.post_comments where id='a1b2c3d4-0000-4000-8000-0000000000f2'),'<null>')||' (expect "u comment edit-target")';

-- 12. ★ THE REGRESSION GUARD ★ — UNVERIFIED U CAN still SOFT-DELETE their own comment.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','236bd757-af85-4834-964f-257e0453aae3','role','authenticated')::text, true);
do $$ begin
  update public.post_comments set deleted_at = now() where id='a1b2c3d4-0000-4000-8000-0000000000f3';
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 12, 'unverified CAN soft-delete own comment (must NOT be blocked)',
  (select deleted_at is not null from public.post_comments where id='a1b2c3d4-0000-4000-8000-0000000000f3'),
  'C_u2.deleted_at set = '||coalesce((select (deleted_at is not null)::text from public.post_comments where id='a1b2c3d4-0000-4000-8000-0000000000f3'),'<missing>')
    ||', body nulled = '||coalesce((select (body is null)::text from public.post_comments where id='a1b2c3d4-0000-4000-8000-0000000000f3'),'<missing>');

-- 13. ADMIN K (unverified) CAN rewrite an existing post body — admin branch applies to the trigger.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','1258b010-291b-434c-a6a4-a1f6fee0d9b9','role','authenticated')::text, true);
do $$ begin
  update public.posts set body='k edited ok' where id='a1b2c3d4-0000-4000-8000-0000000000f4';
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 13, 'admin (unverified) CAN edit post body',
  (select body from public.posts where id='a1b2c3d4-0000-4000-8000-0000000000f4') = 'k edited ok',
  'P_k.body = '||coalesce((select body from public.posts where id='a1b2c3d4-0000-4000-8000-0000000000f4'),'<null>')||' (expect "k edited ok")';

-- 14. ADMIN K (unverified) CAN publish a QUOTE-repost — admin branch applies to the quote gate.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','1258b010-291b-434c-a6a4-a1f6fee0d9b9','role','authenticated')::text, true);
do $$ begin
  insert into public.post_reposts (post_id, user_id, view, quote)
    values ('a1b2c3d4-0000-4000-8000-0000000000f5','1258b010-291b-434c-a6a4-a1f6fee0d9b9','us','admin quote ok');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 14, 'admin (unverified) CAN quote-repost',
  exists(select 1 from public.post_reposts where post_id='a1b2c3d4-0000-4000-8000-0000000000f5' and user_id='1258b010-291b-434c-a6a4-a1f6fee0d9b9' and quote is not null),
  'admin quote-repost present = '||exists(select 1 from public.post_reposts where post_id='a1b2c3d4-0000-4000-8000-0000000000f5' and user_id='1258b010-291b-434c-a6a4-a1f6fee0d9b9' and quote is not null)::text;

-- ═══ RESULT — every row must be pass = true; summary must be all_passed = true ═══════════════
select n, label, pass, detail from _t order by n, label;
select bool_and(pass) as all_passed, count(*) filter (where not pass) as failures from _t;
