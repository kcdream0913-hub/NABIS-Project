# Migration verification convention (`*.verify.sql`)

Every migration should ship with a sibling `<migration>.verify.sql` that asserts the
**end state** the migration is supposed to produce — not the diff, and not just the
statements re-run. Run it **after** applying the migration (psql or the SQL editor).

## Why

`<migration>.sql` + `<migration>.rollback.sql` describe the *change*. Neither proves
the database actually reached the intended state — and a migration can silently
under-deliver (the D-057 case: `revoke ... from anon, authenticated` ran without
error but left the PUBLIC grant in place, so the roles still had EXECUTE). A verify
script is the independent check that the end state holds.

## Rules

1. **Assert, don't report.** Every check `raise exception` on mismatch. A clean run
   (no error) is the pass signal. Do not rely on eyeballing a result set.
2. **No silent zero-row pass (D-058).** A `select count(*) = 0` (or a `SELECT ... = false`
   that returns a value nobody checks) passes both when the guard works and when the
   query targets the wrong object and matches nothing. Enumerate the exact objects
   and roles; a mistargeted query must fail loudly. `SELECT ... INTO` a variable and
   assert the variable, so a missing row raises instead of leaving NULL unchecked.
3. **End state, not diff.** Assert the values that must be true now (a column exists
   with the right type/default, a policy exists, a grant is present/absent, a bucket
   has the right limit), independent of what the migration did to get there.
4. **Idempotent + read-only.** A verify script never mutates; it can be re-run any time.

## Example

`20260728160000_msg_attachments_expand_and_notif_revokes.verify.sql` asserts the
bucket config (50MB / 11 mime / private) and that `anon` + `authenticated` hold **no**
EXECUTE on the four notify/protect functions — the D-057 property. The one line that
would have caught D-057 on its own:

```sql
select has_function_privilege('anon', 'public.notify_post_reaction()', 'EXECUTE') = false;
```

(In a real verify script, wrap that in a `raise exception` so it fails loudly rather
than returning `false` for someone to notice.)

## Retrofit

New migrations get a verify script as they land. Existing migrations are backfilled
incrementally, highest-risk first (anything touching grants/RLS/policies before pure
additive column adds).
