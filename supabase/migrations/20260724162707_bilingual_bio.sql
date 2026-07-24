-- Bilingual bios (additive). Existing `bio` stays English (not renamed); `bio_ne`
-- holds the Nepali version. Both nullable/optional. Applied on a branch, advisors
-- clean, NOT merged until the hub OKs. (File is renamed to the branch-assigned
-- version once applied.)
alter table public.profiles   add column if not exists bio_ne text;
alter table public.businesses add column if not exists bio_ne text;
