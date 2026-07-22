# Archived migrations

These 7 migrations were captured earlier as forward migrations. They are all
**subsumed by** `supabase/migrations/00000000000000_baseline.sql`, which
snapshots the full current prod schema (their end-state included).

They are kept here for provenance but moved **out of the apply path** so
`supabase db reset` applies the baseline alone and nothing double-creates.
Re-adding them under `supabase/migrations/` would collide with the baseline —
most sharply `20260722095956_...`, whose `alter function ... set schema private`
fails once the functions already live in `private`.

If the baseline is ever rejected in favor of replaying granular migrations,
these move back — but note the 19 *other* prod migrations were never captured
in this repo, so a granular replay from empty is not currently possible. That
is exactly why a squashed baseline was introduced.
