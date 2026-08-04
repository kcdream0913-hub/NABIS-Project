-- BL-AVATAR-01.verify.sql — proves the avatars storage RLS. MUST RUN INSIDE ONE TRANSACTION,
-- with the migration applied earlier in the SAME open txn:
--
--     begin;
--       \i docs/BL-AVATAR-01.sql
--       \i docs/BL-AVATAR-01.verify.sql
--     rollback;
--
-- SET LOCAL requires the explicit transaction; run outside one and the role never switches and
-- everything passes for the wrong reason. Everything rolls back — no objects persist.
--
-- WHY the role spoof (D-039): a superuser / execute_sql session runs with RLS BYPASSED and
-- auth.uid() NULL, so an unspoofed insert into storage.objects proves nothing. Each case
-- switches to `authenticated` + sets request.jwt.claims.sub, attempts the insert inside a DO
-- block that swallows ONLY insufficient_privilege (42501 = the RLS denial), then resets role and
-- records by object presence. A non-42501 error is NOT swallowed — it aborts loudly.
--
-- Fixtures are REAL prod ids (read live 2026-08-04); repoint if they change:
--   U 236bd757-af85-4834-964f-257e0453aae3  a user (non-owner of B below)
--   V 0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b  a user AND owner of business B
--   B 087b32a5-3c93-4eb6-aeb0-f93d08e80193  a business owned by V
--
-- D-058: every negative is paired with a positive control that MUST insert an object, so a
-- zero-object match cannot read as green.

create temp table _t(n int, label text, pass boolean, detail text) on commit drop;

-- 0. Bucket is public (the whole caching rationale depends on it).
insert into _t select 0, 'avatars bucket is public',
  coalesce((select public from storage.buckets where id='avatars'), false),
  'public = '||coalesce((select public::text from storage.buckets where id='avatars'),'<missing>');

-- 1. U CAN write into its OWN user prefix (positive control).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','236bd757-af85-4834-964f-257e0453aae3','role','authenticated')::text, true);
do $$ begin
  insert into storage.objects (bucket_id, name) values ('avatars','user/236bd757-af85-4834-964f-257e0453aae3/a.webp');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 1, 'user CAN write own prefix',
  exists(select 1 from storage.objects where bucket_id='avatars' and name='user/236bd757-af85-4834-964f-257e0453aae3/a.webp'),
  'object present = '||exists(select 1 from storage.objects where bucket_id='avatars' and name='user/236bd757-af85-4834-964f-257e0453aae3/a.webp')::text;

-- 2. ★ LOAD-BEARING NEGATIVE ★ — U CANNOT write into V's user prefix.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','236bd757-af85-4834-964f-257e0453aae3','role','authenticated')::text, true);
do $$ begin
  insert into storage.objects (bucket_id, name) values ('avatars','user/0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b/b.webp');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 2, 'user CANNOT write another user prefix',
  not exists(select 1 from storage.objects where bucket_id='avatars' and name='user/0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b/b.webp'),
  'objects written by the blocked attempt: '||(select count(*) from storage.objects where bucket_id='avatars' and name='user/0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b/b.webp')||' (expect 0)';

-- 3. U (NON-owner) CANNOT write business B's logo prefix.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','236bd757-af85-4834-964f-257e0453aae3','role','authenticated')::text, true);
do $$ begin
  insert into storage.objects (bucket_id, name) values ('avatars','business/087b32a5-3c93-4eb6-aeb0-f93d08e80193/c.webp');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 3, 'non-owner CANNOT write business logo',
  not exists(select 1 from storage.objects where bucket_id='avatars' and name='business/087b32a5-3c93-4eb6-aeb0-f93d08e80193/c.webp'),
  'objects written by the blocked attempt: '||(select count(*) from storage.objects where bucket_id='avatars' and name='business/087b32a5-3c93-4eb6-aeb0-f93d08e80193/c.webp')||' (expect 0)';

-- 4. V (the OWNER of B) CAN write B's logo prefix (positive control for #3).
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','0183b0d8-59f7-4ea1-bca3-f6d8ca045e9b','role','authenticated')::text, true);
do $$ begin
  insert into storage.objects (bucket_id, name) values ('avatars','business/087b32a5-3c93-4eb6-aeb0-f93d08e80193/d.webp');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 4, 'business OWNER CAN write business logo',
  exists(select 1 from storage.objects where bucket_id='avatars' and name='business/087b32a5-3c93-4eb6-aeb0-f93d08e80193/d.webp'),
  'object present = '||exists(select 1 from storage.objects where bucket_id='avatars' and name='business/087b32a5-3c93-4eb6-aeb0-f93d08e80193/d.webp')::text;

-- 5. Unknown prefix is rejected (the predicate's else branch → false), even in your own name.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','236bd757-af85-4834-964f-257e0453aae3','role','authenticated')::text, true);
do $$ begin
  insert into storage.objects (bucket_id, name) values ('avatars','foo/236bd757-af85-4834-964f-257e0453aae3/e.webp');
exception when insufficient_privilege then null; end $$;
reset role;
insert into _t select 5, 'unknown kind prefix rejected',
  not exists(select 1 from storage.objects where bucket_id='avatars' and name='foo/236bd757-af85-4834-964f-257e0453aae3/e.webp'),
  'objects written by the blocked attempt: '||(select count(*) from storage.objects where bucket_id='avatars' and name='foo/236bd757-af85-4834-964f-257e0453aae3/e.webp')||' (expect 0)';

-- RESULT — every row must be pass = true.
select n, label, pass, detail from _t order by n;
select bool_and(pass) as all_passed, count(*) filter (where not pass) as failures from _t;
