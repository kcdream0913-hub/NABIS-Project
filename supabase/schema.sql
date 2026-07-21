-- BridgeLink / NABIS-Project — database schema (source of record)
-- This exact DDL is ALREADY APPLIED to the live Supabase project
--   nabis-bridgelink (ref dhnggnxwjgqvghbxelvw).
-- Kept here as schema-as-code. As you build features, add new migrations and
-- COMPLETE/HARDEN the RLS policies (they are starter policies — see §6.2 / §7.1).

-- ============================ CORE TABLES ============================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  phone text,
  oauth_provider text check (oauth_provider in ('google','apple','email','phone')),
  sectors text[] not null default '{}',
  country text check (country in ('us','nepal')),
  city text,
  bio text,
  links jsonb not null default '{}',
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified')),
  special_badge text check (special_badge in ('diplomat')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  bio text,
  country_of_registration text,
  primary_sector text not null,
  secondary_sectors text[] not null default '{}',
  -- max 2 secondary; a sector can't be both primary and secondary
  -- (constraints secondary_sectors_max_2 / secondary_not_primary)
  registration_number text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified')),
  verified_at timestamptz,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  is_paid_provider boolean not null default false,
  access_price_amount numeric(12,2),
  access_price_currency text not null default 'USD',
  payout_account_ref text,
  created_at timestamptz not null default now()
);
create index on public.businesses (primary_sector);
create index on public.businesses (owner_user_id);

create table public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','professional','assistant','employee')),
  status text not null default 'active' check (status in ('invited','active')),
  can_post boolean not null default false,
  verified_via text not null default 'business' check (verified_via in ('self','business')),
  added_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);
create index on public.business_members (user_id);

create table public.verification_records (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('user','business')),
  subject_id uuid not null,
  provider text, document_type text, document_country text,
  checks jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','passed','failed')),
  reviewer_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('business_member','vouch')),
  from_user_id uuid references public.profiles(id),
  target text,
  business_id uuid references public.businesses(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','expired')),
  role text check (role in ('professional','assistant','employee')),
  can_post boolean not null default false,
  expires_at timestamptz, used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, name text not null, description text, sector text,
  owner_user_id uuid references public.profiles(id),
  has_group_discussion boolean not null default false,
  min_tier text, is_private boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.channel_memberships (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table public.direct_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
create table public.direct_thread_participants (
  thread_id uuid not null references public.direct_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (thread_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade,
  thread_id uuid references public.direct_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  check (channel_id is not null or thread_id is not null)
);
create index on public.messages (channel_id, created_at);
create index on public.messages (thread_id, created_at);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  posted_as text not null default 'user' check (posted_as in ('user','business')),
  business_id uuid references public.businesses(id) on delete set null,
  channel_id uuid references public.channels(id) on delete set null,
  body text not null,
  view text check (view in ('us','nepal','bridge')),
  created_at timestamptz not null default now()
);
create index on public.posts (created_at desc);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null, date date, "time" text,
  mode text check (mode in ('in_person','online')),
  location text, view text check (view in ('us','nepal','bridge')),
  description text, host_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.rsvps (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create table public.access_purchases (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references public.profiles(id) on delete cascade,
  provider_type text not null check (provider_type in ('business','user')),
  provider_id uuid not null,
  amount numeric(12,2) not null, currency text not null default 'USD',
  platform_fee numeric(12,2), provider_payout numeric(12,2),
  status text not null default 'pending' check (status in ('pending','paid','refunded')),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null, target_id uuid not null,
  reporter_id uuid references public.profiles(id), reason text,
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  reviewer_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null, target_type text, target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ============================ RLS ============================
-- RLS is ENABLED on every table with STARTER policies (browse-friendly reads,
-- own-row / owner-scoped writes, participant-scoped messages, sensitive tables
-- locked to service role). Harden per feature as you build. Run the Supabase
-- security advisor after DDL changes. (Full policy statements applied in migration
-- `enable_rls_and_starter_policies`; see the Supabase dashboard -> Auth -> Policies.)

-- ============================ AUTH TRIGGER + SEED ============================
-- A trigger (handle_new_user) inserts a public.profiles row on every auth signup.
-- The 8 launch channels are seeded: investment-policy, logistics-supply-chain,
-- tourism-hospitality, tech-ai, immigration-legal, media-journalism, entrepreneurs,
-- freelancers-outsourcing.
