-- column_blind_writes.sql — the standing lint that stops a SEVENTH column-blind-write instance.
-- Returns one row per public table that has a client-writable INSERT/UPDATE policy AND a
-- server-owned column AND no BEFORE INSERT guard. CI must FAIL the job on any returned row and
-- print it so the failure names the table. Expected steady state: ZERO rows.
--
-- Runs against a PROD-EQUIVALENT schema only (a `supabase start` local stack built from the
-- baseline, or the E2E project) — NOT today's incomplete migrations, which would give false
-- results. Pair it ALWAYS with column_blind_writes.control.sql (the positive control): a lint that
-- returns zero rows because it is BROKEN is indistinguishable from a clean codebase (D-058).
--
-- HISTORY — two authoring mistakes, kept so they are not repeated:
--   v1 included `created_at` in the server-owned list → 12 flags, ~10 of them noise (rsvps,
--      post_reactions, thread_keys…). A gate that cries wolf gets muted; created_at is handled
--      per-table by the intake triggers, not flagged here.
--   v2 silently dropped EVERY INSERT policy: for INSERT rows `qual` is NULL, so
--      `not (qual ilike … or with_check ilike …)` evaluated to NULL and the row vanished — the lint
--      returned nothing and looked clean. Hence coalesce() on both sides, and hence the positive
--      control. A known-bad table (access_purchases, reports) disappearing from the output is the
--      tell that the lint itself broke.
--
-- RULE: the flag list must reach ZERO within one task — guard the table (BEFORE INSERT trigger /
-- drop the policy) OR allow-list it below WITH A REASON. A permanently-red check is muted like any
-- noisy gate, which is the same as no check.
with server_owned as (
  select table_name, string_agg(column_name, ', ' order by column_name) cols
  from information_schema.columns
  where table_schema='public'
    and column_name in ('status','verification_status','verified_at','is_paid_provider',
                        'reviewer_id','amount','platform_fee','provider_payout','special_badge')
  group by table_name
),
write_policies as (
  select tablename, string_agg(distinct policyname, ', ') as policies
  from pg_policies
  where schemaname='public' and cmd in ('INSERT','UPDATE')
    and coalesce(qual,'')       !~* '(is_admin|admin_users)'
    and coalesce(with_check,'') !~* '(is_admin|admin_users)'
  group by tablename
),
guarded as (
  select distinct c.relname as tablename
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and not t.tgisinternal
    and pg_get_triggerdef(t.oid) ilike '%BEFORE INSERT%'
),
allowlisted(tablename, reason) as (values
  ('events',    'status is host-scoped; a host can already publish/cancel their own event via update — forge hits only their own row'),
  ('offerings', 'status is owner-scoped; an owner can already publish/unpublish their own listing — no cross-boundary escalation'),
  ('invites',   'redemption requires status=pending AND an email match, so a forged accepted blocks its own redemption — no membership gain')
)
select w.tablename, s.cols, w.policies
from write_policies w
join server_owned s on s.table_name = w.tablename
left join guarded g on g.tablename = w.tablename
left join allowlisted a on a.tablename = w.tablename
where g.tablename is null and a.tablename is null
order by w.tablename;
