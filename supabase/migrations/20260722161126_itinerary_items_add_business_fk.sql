-- itinerary_items_add_business_fk — applied to prod 2026-07-22 (version 20260722161126).
-- Captured retroactively from the live database, cross-checked against
-- ROLLBACK_itinerary_items_add_business_fk.sql.
--
-- Links a staged itinerary item back to a real directory business, so trip-planner
-- recommendations stop being anonymous curated text. Nullable by design: hand-typed
-- items and the curated example templates carry no business_id.
-- ON DELETE SET NULL — removing a business must not delete someone's trip plan.

alter table public.itinerary_items
  add column if not exists business_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'itinerary_items_business_id_fkey'
  ) then
    alter table public.itinerary_items
      add constraint itinerary_items_business_id_fkey
      foreign key (business_id) references public.businesses(id) on delete set null;
  end if;
end $$;

create index if not exists itinerary_items_business_id_idx
  on public.itinerary_items using btree (business_id);

comment on column public.itinerary_items.business_id is
  'Optional link to the directory business this item was staged from. Null for hand-typed or curated-template items.';
