-- BL-AVATAR-02.verify.sql — proves the SCOPED SELECT restores what deletion needs WITHOUT
-- reopening enumeration. MUST RUN INSIDE ONE TRANSACTION with the migration applied earlier in
-- the SAME open txn:
--     begin;
--       \i docs/BL-AVATAR-02.sql
--       \i docs/BL-AVATAR-02.verify.sql
--     rollback;                         -- nothing persists (the fixtures are real storage.objects rows)
--
-- ⚠ WE DO NOT TEST THE DELETE ITSELF HERE. `delete from storage.objects` raises
--     42501  "Direct deletion from storage tables is not allowed. Use the Storage API instead."
-- — a Supabase guard, NOT an RLS result, so a SQL-delete test would fail for a reason unrelated
-- to the policy and read as a broken fix. SELECT VISIBILITY is the actual precondition remove()
-- depends on (the Storage API resolves an object via SELECT before deleting it); the real delete
-- is a click-through check.
--
-- WHY the role spoof (D-039): a superuser session bypasses RLS + auth.uid() is null, so an
-- unspoofed select proves nothing. Fixtures are inserted as the PRIVILEGED role (RLS bypassed).
-- Visibility is ROLE-DEPENDENT, so each count is measured UNDER the spoofed user and captured
-- into a txn-local GUC (a temp table cannot be written from the `authenticated` role — it is
-- owned by the session role), then the result is assembled as the privileged role.
--
-- Fixtures: U 236bd757-…  V 0183b0d8-… (owner of business B)  B 087b32a5-…
-- Case 5 is a REAL-DATA proof: the orphan the D-084 bug left is now visible to its owner KC.

insert into storage.objects (bucket_id, name) values
  ('avatars','user/236bd757-af85-4834-964f-257e0453aae3/t1.webp'),
  ('avatars','user/0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b/t2.webp'),
  ('avatars','business/087b32a5-3c93-4eb6-aeb0-f93d08e80193/t3.webp');

-- ── as U (non-owner of B): sees own t1, must NOT see V's t2 or B's t3 ───────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','236bd757-af85-4834-964f-257e0453aae3','role','authenticated')::text, true);
select set_config('bla2.u_own',   (select count(*) from storage.objects where name='user/236bd757-af85-4834-964f-257e0453aae3/t1.webp')::text, true);
select set_config('bla2.u_other', (select count(*) from storage.objects where name='user/0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b/t2.webp')::text, true);
select set_config('bla2.u_biz',   (select count(*) from storage.objects where name='business/087b32a5-3c93-4eb6-aeb0-f93d08e80193/t3.webp')::text, true);
reset role;

-- ── as V (owner of B): sees the logo object ─────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b','role','authenticated')::text, true);
select set_config('bla2.v_biz', (select count(*) from storage.objects where name='business/087b32a5-3c93-4eb6-aeb0-f93d08e80193/t3.webp')::text, true);
reset role;

-- ── as KC (owner of the real orphan) — REAL-DATA proof the fix resolves the leaked object ────
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','1258b010-291b-434c-a6a4-a1f6fee0d9b9','role','authenticated')::text, true);
select set_config('bla2.orphan', (select count(*) from storage.objects where name='user/1258b010-291b-434c-a6a4-a1f6fee0d9b9/5f768cf9-8467-45a2-837f-1864a607fd5f.webp')::text, true);
reset role;

-- ── result (privileged role): every row must be pass = true ─────────────────────────────────
select * from (values
  (1,'owner CAN select own object (remove precondition)',        current_setting('bla2.u_own')::int   = 1, 'visible='||current_setting('bla2.u_own')||' (want 1)'),
  (2,'user CANNOT select another user''s object (enum closed)',  current_setting('bla2.u_other')::int = 0, 'visible='||current_setting('bla2.u_other')||' (want 0)'),
  (3,'non-owner CANNOT select a business logo object',           current_setting('bla2.u_biz')::int   = 0, 'visible='||current_setting('bla2.u_biz')||' (want 0)'),
  (4,'business OWNER CAN select the logo object',                current_setting('bla2.v_biz')::int   = 1, 'visible='||current_setting('bla2.v_biz')||' (want 1)'),
  (5,'orphan now visible to its owner KC (remove would resolve)',current_setting('bla2.orphan')::int  = 1, 'visible='||current_setting('bla2.orphan')||' (want 1)')
) as t(n, label, pass, detail)
order by n;
