# BASELINE_FINGERPRINT — the strong equivalence check for the E2E restore (D-085)

Counts (36 tables, 98+10 policies, 7+24 functions, 16 triggers, 3 buckets) are a NECESSARY but
WEAK check: all seven pass if `posts_select` restores as `using (false)` instead of `using
(true)`, if a `with check` is dropped, a generated column comes back plain, a `security definer`
function comes back `invoker`, or a CHECK vanishes. That is exactly the silent-drift this task
exists to prevent, in the one database whose job is telling you whether RLS works.

This fingerprint is nine md5 hashes over the **parsed definitions** of every object that matters.
Run the query below on `sangamline-e2e` after the restore (files `00000000000001` +
`00000000000002`, and the pre-restore privilege trap — see the runbook). **Nine matches = the
schema is the same schema.**

## ⚠ THESE HASHES CHANGE ON EVERY APPLIED MIGRATION — re-capture + commit in the SAME change

**Any** migration applied to prod invalidates the hashes below; leave them stale and the E2E
restore check fails for a bookkeeping reason and reads as a broken restore. So whenever a migration
is applied to prod, re-run the query (below) and commit the new hashes in the same change. (This
bit once already: `bl_feedback_02_pilot_feedback_capture`, applied 2026-08-04, bumped 7 of 9 — a
table-only change, so `buckets` + `enums` did NOT move, which is the fingerprint checking itself.)

## Expected (captured from prod `dhnggnxwjgqvghbxelvw` 2026-08-04, AFTER
## `bl_feedback_02_pilot_feedback_capture`; the coding session independently re-ran this query the
## same day and confirmed all nine — a verified value, not a transcribed one)

| part | expected md5 | |
|---|---|---|
| `buckets` | `61d0c44ed7fb18045b9a1c128411f012` | unchanged by bl_feedback_02 |
| `columns` | `0d0e8bdce70928d20a773977aee730c6` | |
| `constraints` | `dd98727909c2de720cc60a5337845d40` | |
| `enums` | `d41d8cd98f00b204e9800998ecf8427e` | unchanged (md5 of '') |
| `functions` | `56036b423f5a1e24adf46119175b2376` | |
| `indexes` | `1da83391a20b6415f1827829412a345e` | |
| `policies` | `9aee018cf3998b42e3448df4aa7cbe85` | |
| `rls_flags` | `5e6823fe1606b72e640bec0c83cb0f18` | |
| `triggers` | `fd70065a3d626a97864dda2c2d14256b` | |

**`enums` = `d41d8cd9…` is md5 of the empty string** — there are NO custom enum types in `public`
or `private`. Every constrained field is `text` + a CHECK, which is why `body_lang='xx'` raised
`23514` and not an enum-cast error, and why the `constraints` fingerprint carries the entire
validation surface. Recorded as a fact.

## Why parsed, not text

`pg_policies.qual`, `pg_get_constraintdef()`, `pg_get_triggerdef()` render Postgres's PARSED
form, so `bucket_id = 'avatars'` and `(bucket_id = 'avatars'::text)` hash identically. Formatting
differences in the hand-transcribed storage file (`00000000000002`) cannot cause a false
mismatch — only a semantic difference can.

## The query — run IDENTICALLY on both projects (verbatim; any edit changes the hashes)

```sql
with cols as (
  select string_agg(
    format('%s.%s|%s|%s|%s|%s|%s|%s', c.table_schema, c.table_name, c.column_name, c.ordinal_position,
           c.data_type, c.is_nullable, coalesce(c.column_default,'-'),
           coalesce(c.is_generated,'-')||':'||coalesce(c.generation_expression,'-')),
    E'\n' order by c.table_schema, c.table_name, c.ordinal_position) as v
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema=c.table_schema and t.table_name=c.table_name and t.table_type='BASE TABLE'
  where c.table_schema in ('public','private')
), cons as (
  select string_agg(format('%s.%s|%s|%s', n.nspname, r.relname, k.conname, pg_get_constraintdef(k.oid)),
    E'\n' order by n.nspname, r.relname, k.conname) as v
  from pg_constraint k join pg_class r on r.oid=k.conrelid join pg_namespace n on n.oid=r.relnamespace
  where n.nspname in ('public','private')
), idx as (
  select string_agg(format('%s|%s', i.indexname, i.indexdef), E'\n' order by i.schemaname, i.tablename, i.indexname) as v
  from pg_indexes i where i.schemaname in ('public','private')
), pol as (
  select string_agg(format('%s.%s|%s|%s|%s|%s|%s|%s', p.schemaname, p.tablename, p.policyname, p.cmd,
           p.permissive, p.roles::text, coalesce(p.qual,'-'), coalesce(p.with_check,'-')),
    E'\n' order by p.schemaname, p.tablename, p.policyname) as v
  from pg_policies p where p.schemaname in ('public','private','storage')
), rls as (
  select string_agg(format('%s.%s|rls=%s|force=%s', n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity),
    E'\n' order by n.nspname, c.relname) as v
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private') and c.relkind='r'
), fns as (
  select string_agg(format('%s.%s(%s)|sec_def=%s|vol=%s|cfg=%s|body=%s', n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid), p.prosecdef, p.provolatile,
           coalesce(array_to_string(p.proconfig,','),'-'), md5(coalesce(p.prosrc,''))),
    E'\n' order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as v
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private')
), trg as (
  select string_agg(pg_get_triggerdef(t.oid), E'\n' order by pg_get_triggerdef(t.oid)) as v
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private') and not t.tgisinternal
), buckets as (
  select string_agg(format('%s|public=%s|limit=%s|mime=%s', b.id, b.public, coalesce(b.file_size_limit::text,'-'),
           coalesce(array_to_string(b.allowed_mime_types,','),'-')), E'\n' order by b.id) as v
  from storage.buckets b
), enums as (
  select string_agg(format('%s.%s=%s', n.nspname, t.typname, e.enumlabel), E'\n' order by n.nspname, t.typname, e.enumsortorder) as v
  from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace
  where n.nspname in ('public','private')
)
select 'buckets' as part, md5(coalesce((select v from buckets),'')) as fp union all
select 'columns',     md5(coalesce((select v from cols),''))    union all
select 'constraints', md5(coalesce((select v from cons),''))    union all
select 'enums',       md5(coalesce((select v from enums),''))   union all
select 'functions',   md5(coalesce((select v from fns),''))     union all
select 'indexes',     md5(coalesce((select v from idx),''))     union all
select 'policies',    md5(coalesce((select v from pol),''))     union all
select 'rls_flags',   md5(coalesce((select v from rls),''))     union all
select 'triggers',    md5(coalesce((select v from trg),''))
order by 1;
```

## When a part mismatches

Replace the final `select … md5(…)` block with `select v from <part>;` on BOTH projects and diff
the raw outputs — the hash names WHICH category broke, the raw text names WHICH object.

## Scope / caveats (so a benign difference can't read as a red alert)

- **`auth` and `storage` TABLE structure are deliberately out of scope** — Supabase-managed, they
  legitimately differ between projects created at different times. Only storage *policies* +
  *bucket config* are fingerprinted (the parts that are ours).
- Verified to run + produce stable output on prod; **not yet run against a restored copy** (none
  exists). If `indexes` or `columns` mismatches on an otherwise-sane restore, **suspect the
  fingerprint first** and diff the raw output — a `pg_dump`-side rename of an unnamed constraint
  is the most likely benign cause. `policies`, `functions`, `rls_flags`, `triggers` have NO such
  benign failure mode: a mismatch there is real.
