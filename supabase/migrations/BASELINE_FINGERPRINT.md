# BASELINE_FINGERPRINT — the strong equivalence check for the E2E restore (D-085 / D-090)

Counts (36 tables, 97+10 policies, 7+25 functions, 17 triggers, 3 buckets) are a NECESSARY but
WEAK check: all pass if `posts_select` restores as `using (false)` instead of `using (true)`, if a
`with check` is dropped, a generated column comes back plain, a `security definer` function comes
back `invoker`, or a CHECK vanishes. That is exactly the silent-drift this task exists to prevent,
in the one database whose job is telling you whether RLS works.

This fingerprint is **ten** md5 hashes over the **parsed definitions** of every object that matters.
Run the query below on the restore target (a local `supabase start` stack, or a dedicated project)
after the restore (files `00000000000001` + `00000000000002`, and the pre-restore privilege trap —
see the runbook). **Ten matches = the schema is the same schema.** The tenth part (`ext_triggers`)
was added after nine proved passable on a database where signup silently fails to create a profile
(the `auth`-schema trigger the dump drops) — see the caveat at the bottom.

## ⚠ LOCATION + the re-capture rule (D-090 — the finding that created this file on `main`)

This file lives on **`main`**, the branch where applied migrations land, because the rule below is
only followable if the fingerprint travels with the migrations:

> **These hashes MUST be re-captured + committed in the SAME change as any migration applied to
> prod.** A fingerprint that lags the schema is worse than none — it produces a mismatch nobody
> trusts, so it gets ignored, and then it catches nothing.

History of it lagging (both the reason the rule is in bold): the values were recorded once on
2026-08-04 on the parked `bl-e2e-split-01` branch and then NOT updated when
`bl_profile_01_headline` was applied on 2026-08-05, and a BL-OPS-01 report even claimed "prod's
nine hashes still match the committed fingerprint" when nothing was committed on `main` at all. A
check nobody can run is not a check. A **stale copy still exists on `bl-e2e-split-01`** (pre-
`profile-01` values); when that branch merges (with the baseline dump) it reconciles to the values
here — take `main`'s.

Every applied migration moves only the parts it touches, which is the fingerprint checking itself:
`bl_feedback_02` moved 7 of 9 (a table-only change — `buckets`+`enums` did not move);
`bl_trust_02` moved exactly `functions`/`policies`/`triggers`; **`bl_profile_01_headline`
(2026-08-05) moved exactly `columns` + `constraints`** (a column + its CHECK), nothing else.

## Expected (captured from prod `dhnggnxwjgqvghbxelvw` 2026-08-05, AFTER
## `bl_feedback_02_pilot_feedback_capture` + `bl_trust_02_close_column_blind_writes` +
## `bl_profile_01_headline`; the coding session INDEPENDENTLY re-ran this query and confirmed all
## nine against the hub's post-apply capture — a verified value, not transcribed)

| part | expected md5 | |
|---|---|---|
| `buckets` | `61d0c44ed7fb18045b9a1c128411f012` | unchanged since 2026-08-04 (storage config stable) |
| `columns` | `d6d2e4c609713d67cd2d32e68b1d6afe` | changed by bl_profile_01_headline (+profiles.headline) |
| `constraints` | `56b83475c5176ee157caf05ef2bf2207` | changed by bl_profile_01_headline (+headline CHECK) |
| `enums` | `d41d8cd98f00b204e9800998ecf8427e` | md5 of '' — no custom enum types (stable) |
| `functions` | `84f6fa551820c6a36c08dd36d9b70fb3` | unchanged since bl_trust_02 |
| `indexes` | `1da83391a20b6415f1827829412a345e` | |
| `policies` | `af71a205a85983bb9518831c4780ecb1` | unchanged since bl_trust_02 (headline adds NO policy) |
| `rls_flags` | `5e6823fe1606b72e640bec0c83cb0f18` | |
| `triggers` | `e0eac6248ad58c1ba9a1ade069458d20` | unchanged since bl_trust_02 (public+private) |
| `ext_triggers` | `9132f713c52a5727870df7112d5373e1` | auth+storage — catches the on_auth_user_created drop (see caveat) |

**`enums` = `d41d8cd9…` is md5 of the empty string** — there are NO custom enum types in `public`
or `private`. Every constrained field is `text` + a CHECK, which is why `body_lang='xx'` raised
`23514` and not an enum-cast error, and why the `constraints` fingerprint carries the entire
validation surface (incl. the new `char_length(headline) <= 120`). Recorded as a fact.

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
), ext_trg as (
  -- D-090 / BL-E2E-SPLIT-01: triggers in the EXCLUDED schemas (auth, storage). `supabase db dump`
  -- drops these, so the other nine parts (scoped public+private) CANNOT see them — most critically
  -- auth.users/on_auth_user_created, which fires public.handle_new_user() to create the profiles
  -- row on signup. Without it a restored DB accepts signups but never makes a profile (silent). The
  -- excluded-schema baseline half recreates it; this part is how a restore that forgot it FAILS.
  select string_agg(pg_get_triggerdef(t.oid), E'\n' order by pg_get_triggerdef(t.oid)) as v
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('auth','storage') and not t.tgisinternal
)
select 'buckets' as part, md5(coalesce((select v from buckets),'')) as fp union all
select 'columns',     md5(coalesce((select v from cols),''))    union all
select 'constraints', md5(coalesce((select v from cons),''))    union all
select 'enums',       md5(coalesce((select v from enums),''))   union all
select 'functions',   md5(coalesce((select v from fns),''))     union all
select 'indexes',     md5(coalesce((select v from idx),''))     union all
select 'policies',    md5(coalesce((select v from pol),''))     union all
select 'rls_flags',   md5(coalesce((select v from rls),''))     union all
select 'triggers',    md5(coalesce((select v from trg),''))     union all
select 'ext_triggers',md5(coalesce((select v from ext_trg),''))
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
- **`ext_triggers` mixes ours and Supabase's.** Of its five, only `auth.users/on_auth_user_created`
  is ours (recreated by the excluded-schema baseline half `00000000000002`); the other four are
  Supabase-managed `storage.*` triggers that ship with the storage schema. So on a mismatch, DIFF
  THE RAW OUTPUT: a difference in `on_auth_user_created` is a REAL defect (the excluded-schema half
  didn't recreate it → signup won't create profiles); a difference in a managed `storage.*` trigger
  is Supabase version skew (benign, same class as the excluded storage-TABLE structure). The five
  captured 2026-08-05: `on_auth_user_created` + `enforce_bucket_name_length_trigger` +
  `protect_buckets_delete` + `protect_objects_delete` + `update_objects_updated_at`.
