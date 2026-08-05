-- BL-PROFILE-01.verify.sql — proves the Tier-1 presentation columns are writable by a
-- member on their OWN profile only, and that the 120-char headline cap holds. Run INSIDE
-- ONE TRANSACTION with the migration applied earlier in the SAME txn:
--     begin;
--       \i docs/BL-PROFILE-01.sql
--       \i docs/BL-PROFILE-01.verify.sql
--     rollback;                 -- nothing persists
--
-- D-039: a privileged session bypasses RLS + auth.uid() is null, so RLS behaviour is tested
-- under `set local role authenticated` + request.jwt.claims. D-058: every negative is bound to a
-- POSITIVE control — both target rows exist, and P's stored headline is captured before AND after
-- the cross-member attack — so a zero-row / no-op can never read as a pass. Role-dependent reads
-- are captured into txn-local GUCs and assembled under the privileged role at the end.
--
-- Fixtures (real prod ids, same as BL-TRUST-02): M bba57fb8 (member, unverified non-admin) acts;
-- P 849fb749 (another profile) is the cross-member target M must NOT be able to touch.

-- Positive control (privileged read, RLS bypassed): both target profiles exist, so a 0-row update
-- below is RLS denial, not a missing row. Capture P's headline BEFORE the attack (brand-new column
-- => null on every row) to compare against AFTER.
select set_config('blp.m_exists', (select count(*) from public.profiles where id='bba57fb8-29c6-4081-bc63-9899f8c30132')::text, true);
select set_config('blp.p_exists', (select count(*) from public.profiles where id='849fb749-3476-4865-8f6e-97a4011a1cff')::text, true);
select set_config('blp.p_before', (select coalesce(headline,'<null>') from public.profiles where id='849fb749-3476-4865-8f6e-97a4011a1cff'), true);

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub','bba57fb8-29c6-4081-bc63-9899f8c30132','role','authenticated')::text, true);

-- (1) M CAN set OWN headline + links (headline overwritten later by the cap tests, so the links
--     write — never touched again — is the durable proof the own-write landed).
do $$ begin
  update public.profiles
    set headline='Freight forwarder · US–Nepal logistics',
        links='{"website":"https://acme.example","linkedin":"https://www.linkedin.com/in/example"}'::jsonb
  where id='bba57fb8-29c6-4081-bc63-9899f8c30132';
  if found then perform set_config('blp.own','updated',true); else perform set_config('blp.own','no-row',true); end if;
exception when others then perform set_config('blp.own','blocked:'||sqlstate,true); end $$;

-- (2) M must NOT be able to set another member's (P) headline — RLS scopes to id=auth.uid(), so
--     this affects 0 rows (no error). If RLS were broken, P.headline would become 'HACKED'.
do $$ begin
  update public.profiles set headline='HACKED by M' where id='849fb749-3476-4865-8f6e-97a4011a1cff';
  if found then perform set_config('blp.other','updated',true); else perform set_config('blp.other','no-row',true); end if;
exception when others then perform set_config('blp.other','blocked:'||sqlstate,true); end $$;

-- (3) 120-char cap: 121 rejected (23514 check_violation), 120 accepted.
do $$ begin
  update public.profiles set headline=repeat('a',121) where id='bba57fb8-29c6-4081-bc63-9899f8c30132';
  perform set_config('blp.cap121','accepted',true);                          -- BAD if reached
exception when check_violation then perform set_config('blp.cap121','blocked:23514',true);
          when others then perform set_config('blp.cap121','blocked:'||sqlstate,true); end $$;
do $$ begin
  update public.profiles set headline=repeat('b',120) where id='bba57fb8-29c6-4081-bc63-9899f8c30132';
  if found then perform set_config('blp.cap120','accepted',true); else perform set_config('blp.cap120','no-row',true); end if;
exception when others then perform set_config('blp.cap120','blocked:'||sqlstate,true); end $$;

reset role;

-- Privileged reads of the TRUE stored values (RLS-bypass).
select set_config('blp.own_links_website', (select coalesce(links->>'website','<null>') from public.profiles where id='bba57fb8-29c6-4081-bc63-9899f8c30132'), true);
select set_config('blp.own_headline_len',  (select coalesce(char_length(headline),-1)::text from public.profiles where id='bba57fb8-29c6-4081-bc63-9899f8c30132'), true);
select set_config('blp.p_after',           (select coalesce(headline,'<null>') from public.profiles where id='849fb749-3476-4865-8f6e-97a4011a1cff'), true);

-- ═══ result (privileged role): every pass must be true ═════════════════════════════════════════
select * from (values
  (1,'both target profiles exist (positive control)',
     current_setting('blp.m_exists')::int = 1 and current_setting('blp.p_exists')::int = 1,
     'm='||current_setting('blp.m_exists')||' p='||current_setting('blp.p_exists')||' (want 1/1)'),
  (2,'M CAN set OWN headline + links',
     current_setting('blp.own') = 'updated',
     'own='||current_setting('blp.own')||' (want updated)'),
  (3,'M''s own links persisted (durable own-write proof)',
     current_setting('blp.own_links_website') = 'https://acme.example',
     'own_links_website='||current_setting('blp.own_links_website')||' (want https://acme.example)'),
  (4,'M CANNOT set another member''s headline (RLS: 0 rows)',
     current_setting('blp.other') = 'no-row',
     'other='||current_setting('blp.other')||' (want no-row)'),
  (5,'P''s headline is UNCHANGED after the attack (positive control)',
     current_setting('blp.p_after') = current_setting('blp.p_before'),
     'p_before='||current_setting('blp.p_before')||' p_after='||current_setting('blp.p_after')||' (want equal)'),
  (6,'120-char cap REJECTS 121 (check_violation)',
     current_setting('blp.cap121') = 'blocked:23514',
     'cap121='||current_setting('blp.cap121')||' (want blocked:23514)'),
  (7,'120-char cap ACCEPTS exactly 120',
     current_setting('blp.cap120') = 'accepted',
     'cap120='||current_setting('blp.cap120')||' (want accepted)'),
  (8,'the accepted 120-char headline actually stored (len=120)',
     current_setting('blp.own_headline_len') = '120',
     'own_headline_len='||current_setting('blp.own_headline_len')||' (want 120)')
) as t(n, label, pass, detail) order by n;
