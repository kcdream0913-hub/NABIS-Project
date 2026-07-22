-- events_add_timestamptz_and_tz — applied to prod 2026-07-22 (version 20260722155304).
-- Captured retroactively from the live database (definitions dumped from
-- pg_attribute / pg_constraint), cross-checked against
-- ROLLBACK_events_add_timestamptz_and_tz.sql.
--
-- Adds an explicit absolute instant + IANA zone alongside the legacy
-- date/time text columns. All three are additive and nullable: events created
-- before this migration keep rendering from date/time (the events page falls
-- back when starts_at is null). `events` was empty at apply time.

alter table public.events
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at   timestamptz,
  add column if not exists event_tz  text;

comment on column public.events.starts_at is
  'Absolute start instant. Preferred over the legacy date/time text columns; null for pre-migration rows.';
comment on column public.events.ends_at is
  'Absolute end instant. Optional.';
comment on column public.events.event_tz is
  'IANA timezone name (e.g. America/New_York, Asia/Kathmandu) used to render starts_at in the event''s own zone.';
