-- column_blind_writes.control.sql — the POSITIVE CONTROL for column_blind_writes.sql (D-058 applied
-- to the tooling). A lint that returns zero rows because it is BROKEN looks exactly like a clean
-- codebase. This proves the lint's detection machinery still fires: it creates a scratch table with
-- the known-bad shape (a server-owned `status` column + a client-writable INSERT policy + no BEFORE
-- INSERT guard) and RAISES if the lint does NOT flag it.
--
-- Run with psql `ON_ERROR_STOP=1` so the raise exits non-zero and FAILS the CI job. Self-contained
-- in a transaction that always rolls back — leaves nothing behind. Unlike the main lint, this does
-- NOT need a prod-equivalent schema: it builds its own known-bad table, so it validates the lint on
-- any Postgres.
begin;

create table public._lint_control_known_bad (
  id uuid primary key default gen_random_uuid(),
  owner uuid,
  status text
);
alter table public._lint_control_known_bad enable row level security;
create policy _lint_control_ins on public._lint_control_known_bad
  for insert to authenticated with check (owner = auth.uid());   -- client-writable, checks only owner

do $$
declare detected boolean;
begin
  -- the exact detection core of column_blind_writes.sql, asked only about the scratch table.
  select exists (
    with server_owned as (
      select table_name from information_schema.columns
      where table_schema='public'
        and column_name in ('status','verification_status','verified_at','is_paid_provider',
                            'reviewer_id','amount','platform_fee','provider_payout','special_badge')
    ),
    write_policies as (
      select tablename from pg_policies
      where schemaname='public' and cmd in ('INSERT','UPDATE')
        and coalesce(qual,'')       !~* '(is_admin|admin_users)'
        and coalesce(with_check,'') !~* '(is_admin|admin_users)'
    ),
    guarded as (
      select distinct c.relname as tablename
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and not t.tgisinternal and pg_get_triggerdef(t.oid) ilike '%BEFORE INSERT%'
    )
    select 1 from write_policies w
    join server_owned s on s.table_name = w.tablename
    left join guarded g on g.tablename = w.tablename
    where w.tablename = '_lint_control_known_bad' and g.tablename is null
  ) into detected;

  if not detected then
    raise exception 'LINT POSITIVE CONTROL FAILED: column_blind_writes did NOT detect a known-bad table — the lint machinery is broken (D-058). A zero-row lint result cannot be trusted.';
  end if;
end $$;

rollback;
