-- ⚠ psql-ONLY. This uses \set meta-commands and RAISE NOTICE, neither of which
-- works through Supabase's execute_sql / the MCP. To run it there, rewrite:
-- inline the UUIDs as literals, funnel each SELECT into a temp table, wrap the
-- expected-error cases (e.g. the protect-trigger rejection) in DO-block exception
-- handlers, and capture NOTICE output into a temp table (execute_sql returns no
-- notice output). The hub ran exactly such a rewrite for the a0abf04 pass. As
-- written, run this only via `psql`.
--
-- BL-NOTIF-01 — RLS + trigger + protect proofs for the notifications migration.
--
-- WHY THIS FILE EXISTS: the trigger DECISION logic is unit-tested in
-- lib/__tests__/notifications.test.ts (runs in vitest, no DB). The RLS,
-- protect-trigger, and actual-INSERT behavior can only be proven against a live
-- database — and execute_sql runs as an admin role where auth.uid() is NULL, so
-- an unspoofed query proves nothing (D-039). Run this on the DISPOSABLE Supabase
-- branch AFTER applying 20260728140000_notifications.sql, replacing the two UUIDs
-- below with two distinct seeded profiles (A = a post author, B = anyone else).
--
-- Everything runs inside one transaction and ROLLBACKs at the end, so it leaves
-- no rows behind. Change the final ROLLBACK to COMMIT only if you want to keep the
-- fixtures.

\set A '00000000-0000-0000-0000-000000000000'  -- REPLACE: post author (seeded profile id)
\set B '11111111-1111-1111-1111-111111111111'  -- REPLACE: a different seeded profile id
\set C '22222222-2222-2222-2222-222222222222'  -- REPLACE: a third seeded profile id (for the 2-row reply case)

begin;

-- A test post by A (view carried into the notification).
insert into public.posts (id, author_id, posted_as, body, view)
values ('aaaaaaaa-0000-0000-0000-000000000001', :'A', 'user', 'proof post', 'bridge');

-- ── 1. TRIGGER BEHAVIOR (run as admin; triggers fire regardless of RLS) ──────

-- 1a. B reacts to A's post → exactly 1 notification to A (post_reaction).
insert into public.post_reactions (post_id, user_id, kind)
values ('aaaaaaaa-0000-0000-0000-000000000001', :'B', 'like');
-- EXPECT 1 row: recipient A, type post_reaction, view bridge, actor B.
select 'reaction→author' as case, count(*) as rows
  from public.notifications
  where post_id='aaaaaaaa-0000-0000-0000-000000000001' and type='post_reaction';

-- 1b. A reacts to A's OWN post → 0 rows (self-action skipped).
insert into public.post_reactions (post_id, user_id, kind)
values ('aaaaaaaa-0000-0000-0000-000000000001', :'A', 'celebrate');
-- EXPECT still 1 (no self row added).
select 'self-reaction→none' as case, count(*) as rows
  from public.notifications where type='post_reaction'
  and post_id='aaaaaaaa-0000-0000-0000-000000000001';

-- 1c. B comments top-level on A's post → 1 (post_comment to A).
insert into public.post_comments (id, post_id, author_id, body, body_lang)
values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', :'B', 'hi', 'en');
-- EXPECT 1 post_comment to A.
select 'comment→author' as case, count(*) as rows
  from public.notifications where type='post_comment' and recipient_id=:'A';

-- 1d. B replies to their OWN comment on A's post → 1 (post_comment to A only), NOT 2.
insert into public.post_comments (id, post_id, author_id, parent_comment_id, body, body_lang)
values ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', :'B',
        'cccccccc-0000-0000-0000-000000000001', 'me again', 'en');
-- EXPECT 0 comment_reply rows (B would be replying to self), +1 post_comment to A.
select 'self-reply→no comment_reply' as case, count(*) as rows
  from public.notifications where type='comment_reply';   -- EXPECT 0 so far

-- 1e. C replies to B's comment on A's post → 2 rows (comment_reply to B + post_comment to A).
insert into public.post_comments (id, post_id, author_id, parent_comment_id, body, body_lang)
values ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', :'C',
        'cccccccc-0000-0000-0000-000000000001', 'nice', 'en');
-- EXPECT 1 comment_reply to B AND 1 post_comment to A from this insert.
select 'reply→parent+author' as case,
  (select count(*) from public.notifications where type='comment_reply' and recipient_id=:'B') as reply_to_B,
  (select count(*) from public.notifications where type='post_comment' and recipient_id=:'A') as comment_to_A;

-- 1f. B reposts A's post → 1 (post_repost to A).
insert into public.post_reposts (post_id, user_id, view)
values ('aaaaaaaa-0000-0000-0000-000000000001', :'B', 'us');
select 'repost→author' as case, count(*) as rows
  from public.notifications where type='post_repost' and recipient_id=:'A';

-- ── 2. RLS: read own / update own only ───────────────────────────────────────

-- As B: A's notifications are invisible.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'B', 'role', 'authenticated')::text, true);
select 'B sees A''s rows (want 0)' as case, count(*) as rows
  from public.notifications where recipient_id=:'A';   -- EXPECT 0

-- As B: cannot mark A's notification read (0 rows updated — RLS filters them out).
with upd as (
  update public.notifications set read_at = now() where recipient_id=:'A' returning 1
)
select 'B updates A''s rows (want 0)' as case, count(*) as rows from upd;   -- EXPECT 0

reset role;

-- As A: sees own rows, can mark own read.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'A', 'role', 'authenticated')::text, true);
select 'A sees own rows (want >=3)' as case, count(*) as rows
  from public.notifications where recipient_id=:'A';   -- EXPECT the post_comment + post_reaction + post_repost etc.

-- ── 3. protect trigger: only read_at may change ──────────────────────────────

-- 3a. A marking own row read → allowed.
update public.notifications set read_at = now()
  where recipient_id=:'A' and type='post_reaction';   -- EXPECT success

-- 3b. A trying to rewrite `type` on own row → must RAISE 'only read_at may be updated'.
--     Run this line on its own; it is expected to ERROR.
-- update public.notifications set type='post_repost' where recipient_id=:'A' and type='post_reaction';

reset role;

-- ── 4. realtime publication ──────────────────────────────────────────────────
select 'in realtime publication (want 1)' as case, count(*) as rows
  from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename='notifications';   -- EXPECT 1

rollback;   -- leave no fixtures behind (change to COMMIT to keep them)
