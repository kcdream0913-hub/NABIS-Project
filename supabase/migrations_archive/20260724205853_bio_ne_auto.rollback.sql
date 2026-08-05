-- ROLLBACK for 20260724205853_bio_ne_auto.sql
alter table public.profiles   drop column if exists bio_ne_auto;
alter table public.businesses drop column if exists bio_ne_auto;
