-- Inverse of BL-PROFILE-01.sql. Drops ONLY the one column this migration added.
-- `public.profiles.links` is PRE-EXISTING and is left untouched (dropping it would
-- destroy data this migration did not create).
--
-- Dropping the column also drops its char_length(headline) <= 120 CHECK
-- constraint automatically — no separate `drop constraint` needed.

alter table public.profiles
  drop column if exists headline;
