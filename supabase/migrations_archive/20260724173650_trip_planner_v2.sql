-- Trip Planner v2 — Commit A (DB only). Ref: BL-TRIP-01, D-019.
-- Publishers = businesses AND professionals; schema supports all sectors
-- (UI stays tourism-only for now); no live flight API. Additive + backward
-- compatible: existing itineraries/itinerary_items rows keep working.

-- 1) itineraries: corridor direction + endpoints (all nullable).
alter table public.itineraries
  add column if not exists direction text
    check (direction in ('np_to_us', 'us_to_np', 'domestic_np', 'domestic_us', 'other')),
  add column if not exists origin_country text,        -- ISO-3166 alpha-2
  add column if not exists destination_country text;   -- ISO-3166 alpha-2

-- 2) offerings — what a business or professional lists for travellers.
create table if not exists public.offerings (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('business', 'profile')),
  business_id uuid references public.businesses(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  -- exactly the matching owner FK is set for the declared owner_type
  check (
    (owner_type = 'business') = (business_id is not null)
    and (owner_type = 'profile') = (profile_id is not null)
  ),
  sector text not null default 'tourism-hospitality',
  type text not null check (type in (
    'trek', 'tour', 'stay', 'food_experience', 'transport',
    'festival_package', 'guide_service', 'wellness', 'event_package'
  )),
  title text not null,
  title_ne text,
  description text,
  description_ne text,
  country text check (country in ('np', 'us')),
  region text,
  direction_tags text[] not null default '{}',
  price_from numeric,
  price_currency text not null default 'USD',
  price_unit text not null default 'per_person'
    check (price_unit in ('per_person', 'per_group', 'per_night')),
  duration_days int,
  group_min int,
  group_max int,
  seasons text[] not null default '{}',
  festival_slugs text[] not null default '{}',
  available_from date,
  available_to date,
  media jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index the FKs (avoids unindexed_foreign_keys) + the published-read filter.
create index if not exists offerings_business_id_idx on public.offerings (business_id);
create index if not exists offerings_profile_id_idx on public.offerings (profile_id);
create index if not exists offerings_status_idx on public.offerings (status);

alter table public.offerings enable row level security;

-- RLS. "owner" = the professional who owns the profile row, or the user who owns
-- the business. Split by command so there is exactly one permissive policy per
-- command (no multiple_permissive_policies); auth.uid() wrapped in a scalar
-- subselect (no auth_rls_initplan). No policy grants anon anything.
--
-- SELECT: anyone authenticated sees published rows; owners also see their own
--         draft/archived rows.
create policy offerings_select on public.offerings
  for select to authenticated
  using (
    status = 'published'
    or (owner_type = 'profile' and profile_id = (select auth.uid()))
    or (owner_type = 'business' and exists (
      select 1 from public.businesses b
      where b.id = offerings.business_id and b.owner_user_id = (select auth.uid())
    ))
  );

create policy offerings_insert on public.offerings
  for insert to authenticated
  with check (
    (owner_type = 'profile' and profile_id = (select auth.uid()))
    or (owner_type = 'business' and exists (
      select 1 from public.businesses b
      where b.id = offerings.business_id and b.owner_user_id = (select auth.uid())
    ))
  );

create policy offerings_update on public.offerings
  for update to authenticated
  using (
    (owner_type = 'profile' and profile_id = (select auth.uid()))
    or (owner_type = 'business' and exists (
      select 1 from public.businesses b
      where b.id = offerings.business_id and b.owner_user_id = (select auth.uid())
    ))
  )
  with check (
    (owner_type = 'profile' and profile_id = (select auth.uid()))
    or (owner_type = 'business' and exists (
      select 1 from public.businesses b
      where b.id = offerings.business_id and b.owner_user_id = (select auth.uid())
    ))
  );

create policy offerings_delete on public.offerings
  for delete to authenticated
  using (
    (owner_type = 'profile' and profile_id = (select auth.uid()))
    or (owner_type = 'business' and exists (
      select 1 from public.businesses b
      where b.id = offerings.business_id and b.owner_user_id = (select auth.uid())
    ))
  );

-- 3) festivals — reference calendar. Read-only to clients (seeded/admin only).
create table if not exists public.festivals (
  slug text primary key,
  name text not null,
  name_ne text,
  country text check (country in ('np', 'us')),
  month_hint text,
  dates jsonb not null default '{}'::jsonb
);

alter table public.festivals enable row level security;

-- Read for authenticated; no INSERT/UPDATE/DELETE policy → clients cannot write.
create policy festivals_select on public.festivals
  for select to authenticated
  using (true);

-- Seed. Nepal 2026 dates are keyed under "2026"; single-day festivals use equal
-- start/end, windowed ones use the window. US-side slugs carry no fixed dates.
insert into public.festivals (slug, name, name_ne, country, month_hint, dates) values
  ('losar',           'Losar (Sherpa/Tamang New Year)', 'ल्होसार',            'np', 'February',       '{"2026":{"start":"2026-02-06","end":"2026-02-06"}}'::jsonb),
  ('shivaratri',      'Maha Shivaratri',                'महाशिवरात्रि',        'np', 'February',       '{"2026":{"start":"2026-02-15","end":"2026-02-15"}}'::jsonb),
  ('holi',            'Holi (Fagu Purnima)',            'होली',               'np', 'March',          '{"2026":{"start":"2026-03-02","end":"2026-03-02"}}'::jsonb),
  ('nepali-new-year', 'Nepali New Year (Bikram Sambat)', 'नेपाली नयाँ वर्ष',   'np', 'April',          '{"2026":{"start":"2026-04-14","end":"2026-04-14"}}'::jsonb),
  ('buddha-jayanti',  'Buddha Jayanti',                 'बुद्ध जयन्ती',        'np', 'May',            '{"2026":{"start":"2026-05-01","end":"2026-05-01"}}'::jsonb),
  ('tiji',            'Tiji Festival (Upper Mustang)',  'तिजी',               'np', 'May',            '{"2026":{"start":"2026-05-13","end":"2026-05-15"}}'::jsonb),
  ('teej',            'Teej (Haritalika)',              'तीज',                'np', 'September',      '{"2026":{"start":"2026-09-14","end":"2026-09-14"}}'::jsonb),
  ('indra-jatra',     'Indra Jatra',                    'इन्द्रजात्रा',        'np', 'September',      '{"2026":{"start":"2026-09-25","end":"2026-10-02"}}'::jsonb),
  ('dashain',         'Dashain',                        'दशैं',               'np', 'October',        '{"2026":{"start":"2026-10-10","end":"2026-10-25"}}'::jsonb),
  ('tihar',           'Tihar (Deepawali)',              'तिहार',              'np', 'October–November', '{"2026":{"start":"2026-10-29","end":"2026-11-02"}}'::jsonb),
  ('dashain-us',        'Dashain (US celebrations)',      'दशैं (अमेरिका)',       'us', 'October',        '{}'::jsonb),
  ('tihar-us',          'Tihar (US celebrations)',        'तिहार (अमेरिका)',      'us', 'October–November', '{}'::jsonb),
  ('nepali-new-year-us', 'Nepali New Year (US celebrations)', 'नेपाली नयाँ वर्ष (अमेरिका)', 'us', 'April', '{}'::jsonb),
  ('nabis',             'NABIS Summit',                   'नाबिस शिखर सम्मेलन',   'us', 'September',      '{}'::jsonb)
on conflict (slug) do nothing;

-- 4) itinerary_items: link a saved item to the offering it came from.
alter table public.itinerary_items
  add column if not exists offering_id uuid references public.offerings(id) on delete set null;

create index if not exists itinerary_items_offering_id_idx on public.itinerary_items (offering_id);
