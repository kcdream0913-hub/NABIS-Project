-- ROLLBACK for 20260724173650_trip_planner_v2.sql
-- Reverses every object in dependency order. Dropping a column also drops its
-- inline CHECK, so the itineraries.direction constraint needs no explicit drop.

-- 4) unlink itinerary_items from offerings (removes the FK first)
drop index if exists public.itinerary_items_offering_id_idx;
alter table public.itinerary_items drop column if exists offering_id;

-- 2) offerings (cascade drops its policies + indexes)
drop table if exists public.offerings cascade;

-- 3) festivals (cascade drops its policy)
drop table if exists public.festivals cascade;

-- 1) itineraries added columns (drops the inline direction CHECK with the column)
alter table public.itineraries
  drop column if exists direction,
  drop column if exists origin_country,
  drop column if exists destination_country;
