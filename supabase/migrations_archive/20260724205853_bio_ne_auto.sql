-- Bilingual bio: mark machine-translated (not yet owner-reviewed) Nepali bios.
-- Additive + backward compatible. true = auto-translated draft; false (default) =
-- owner-authored or owner-reviewed. Cleared to false when the owner saves bio_ne.
alter table public.profiles   add column if not exists bio_ne_auto boolean not null default false;
alter table public.businesses add column if not exists bio_ne_auto boolean not null default false;
