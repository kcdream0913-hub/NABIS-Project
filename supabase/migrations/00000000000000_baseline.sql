-- =====================================================================
-- BridgeLink / NABIS — DATABASE BASELINE
-- =====================================================================
-- Full schema snapshot of the live prod project (ref dhnggnxwjgqvghbxelvw),
-- captured 2026-07-22 by direct introspection of pg_catalog / pg_policies /
-- pg_get_functiondef / pg_get_triggerdef / pg_get_constraintdef via the
-- Supabase MCP.
--
-- ✅ VERIFIED 2026-07-22 against a throwaway Neon Postgres (Docker was
--   unavailable, so `supabase db reset` / `db diff --linked` could not be used;
--   an equivalent pair of proofs was run instead):
--     RESET PROOF — applied to an empty database (after a small shim supplying
--       the Supabase-managed objects: auth schema, auth.users, auth.uid(), and
--       the anon/authenticated/service_role roles). Zero errors.
--     DIFF PROOF — every schema object in `public` + `private` was reduced to a
--       canonical signature (columns incl. generated + defaults, constraints,
--       indexes, RLS flags, policies, functions, triggers) on BOTH this database
--       and prod, then compared: 381 signatures, all 7 categories identical by
--       count and md5. Empty diff.
--   Caveat, so nobody over-trusts this: the proof covers SCHEMA in public +
--   private only. It does NOT cover table-level GRANTs / default privileges
--   (see notes at the bottom), row data, or the auth/storage schemas.
--   Engine note: the proof DB was PG18 and prod is PG17.6. PG18 materializes
--   NOT NULL constraints as pg_constraint rows (111 of them) which PG17 does
--   not, so those rows are excluded from the constraint comparison — column
--   nullability is still fully compared via the COL signatures.
--
-- RECONCILIATION WITH THE 7 EXISTING MIGRATIONS
--   This baseline reproduces the CURRENT prod schema, which already includes
--   the effects of those 7 migrations. To satisfy "nothing double-creates",
--   they have been moved to supabase/migrations_archive/ (out of the apply
--   path, kept for provenance). `supabase db reset` therefore applies this
--   baseline ALONE. Re-introducing the 7 into supabase/migrations/ would
--   collide — e.g. 20260722095956 does `alter function ... set schema private`,
--   which fails once the functions are already in `private`.
--   NOTE: this is a SCHEMA baseline only (no row data). The sector `channels`
--   seed rows and any reference data live in the separate dev seed step.
--   NOTE: prod also carries 19 migrations never captured in this repo; this
--   snapshot folds them all in, but their individual history is not preserved.
--
-- Platform-managed objects are intentionally omitted (they already exist in a
-- Supabase local stack): the extensions pgcrypto / uuid-ossp / pg_stat_statements
-- / supabase_vault, the auth schema, and the anon/authenticated/service_role
-- roles + their public-schema default privileges.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. private schema (houses SECURITY DEFINER RLS helpers, kept off the API)
-- ---------------------------------------------------------------------
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1. Tables (columns only; constraints and FKs added after all tables exist)
-- ---------------------------------------------------------------------
create table public.access_purchases (
  id uuid not null default gen_random_uuid(),
  buyer_user_id uuid not null,
  provider_type text not null,
  provider_id uuid not null,
  amount numeric(12,2) not null,
  currency text not null default 'USD'::text,
  platform_fee numeric(12,2),
  provider_payout numeric(12,2),
  status text not null default 'pending'::text,
  created_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid not null,
  granted_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid not null default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.business_members (
  id uuid not null default gen_random_uuid(),
  business_id uuid not null,
  user_id uuid not null,
  role text not null,
  status text not null default 'active'::text,
  can_post boolean not null default false,
  verified_via text not null default 'business'::text,
  added_by uuid,
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid not null default gen_random_uuid(),
  name text not null,
  logo_url text,
  bio text,
  country_of_registration text,
  primary_sector text not null,
  registration_number text,
  verification_status text not null default 'unverified'::text,
  verified_at timestamptz,
  owner_user_id uuid not null,
  is_paid_provider boolean not null default false,
  access_price_amount numeric(12,2),
  access_price_currency text not null default 'USD'::text,
  payout_account_ref text,
  created_at timestamptz not null default now(),
  business_email text,
  credentials jsonb not null default '{}'::jsonb,
  social_links jsonb not null default '{}'::jsonb,
  secondary_sectors text[] not null default '{}'::text[]
);

create table public.channel_memberships (
  channel_id uuid not null,
  user_id uuid not null,
  role text not null default 'member'::text,
  joined_at timestamptz not null default now()
);

create table public.channels (
  id uuid not null default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  sector text,
  owner_user_id uuid,
  has_group_discussion boolean not null default false,
  min_tier text,
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.direct_thread_participants (
  thread_id uuid not null,
  user_id uuid not null,
  last_read_at timestamptz
);

create table public.direct_threads (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid not null default gen_random_uuid(),
  title text not null,
  date date,
  "time" text,
  mode text,
  location text,
  view text,
  description text,
  host_id uuid,
  created_at timestamptz not null default now(),
  starts_at timestamptz,
  ends_at timestamptz,
  event_tz text
);

create table public.invites (
  id uuid not null default gen_random_uuid(),
  type text not null,
  from_user_id uuid,
  target text,
  business_id uuid,
  status text not null default 'pending'::text,
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  role text,
  can_post boolean not null default false
);

create table public.itineraries (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  view text,
  start_date date,
  end_date date,
  group_size integer,
  budget_amount numeric(12,2),
  budget_currency text not null default 'USD'::text,
  interests text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create table public.itinerary_items (
  id uuid not null default gen_random_uuid(),
  itinerary_id uuid not null,
  day integer not null default 1,
  title text not null,
  category text,
  estimated_cost numeric(12,2),
  currency text not null default 'USD'::text,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  business_id uuid
);

create table public.messages (
  id uuid not null default gen_random_uuid(),
  channel_id uuid,
  thread_id uuid,
  sender_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.post_reactions (
  post_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid not null default gen_random_uuid(),
  author_id uuid not null,
  posted_as text not null default 'user'::text,
  business_id uuid,
  channel_id uuid,
  body text not null,
  view text,
  created_at timestamptz not null default now()
);

-- profiles.verification_status / verified_at / bridge are STORED GENERATED
-- columns (derived from the per-track us_/np_ columns), not plain defaults.
create table public.profiles (
  id uuid not null,
  name text,
  avatar_url text,
  phone text,
  oauth_provider text,
  sectors text[] not null default '{}'::text[],
  country text,
  city text,
  bio text,
  links jsonb not null default '{}'::jsonb,
  special_badge text,
  created_at timestamptz not null default now(),
  us_verification text not null default 'none'::text,
  np_verification text not null default 'none'::text,
  us_verified_at timestamptz,
  np_verified_at timestamptz,
  verification_status text generated always as (
    case when us_verification = 'verified' or np_verification = 'verified'
         then 'verified' else 'unverified' end
  ) stored,
  verified_at timestamptz generated always as (least(us_verified_at, np_verified_at)) stored,
  bridge boolean generated always as (us_verification = 'verified' and np_verification = 'verified') stored
);

create table public.rd_applications (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  venture_name text not null,
  one_liner text not null,
  stage text not null,
  team_summary text,
  problem_solution text,
  funding_sought text,
  incorporation_status text not null default 'none'::text,
  us_nepal_relevance text,
  links jsonb not null default '{}'::jsonb,
  status text not null default 'submitted'::text,
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reports (
  id uuid not null default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  reporter_id uuid,
  reason text,
  status text not null default 'open'::text,
  reviewer_id uuid,
  created_at timestamptz not null default now()
);

create table public.rsvps (
  user_id uuid not null,
  event_id uuid not null,
  created_at timestamptz not null default now()
);

create table public.verification_records (
  id uuid not null default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  provider text,
  document_type text,
  document_country text,
  checks jsonb not null default '{}'::jsonb,
  status text not null default 'pending'::text,
  reviewer_id uuid,
  created_at timestamptz not null default now(),
  policy_track text not null
);

-- ---------------------------------------------------------------------
-- 2. Primary keys / unique / check constraints (named to match prod)
-- ---------------------------------------------------------------------
alter table public.access_purchases add constraint access_purchases_pkey primary key (id);
alter table public.admin_users add constraint admin_users_pkey primary key (user_id);
alter table public.audit_logs add constraint audit_logs_pkey primary key (id);
alter table public.business_members add constraint business_members_pkey primary key (id);
alter table public.businesses add constraint businesses_pkey primary key (id);
alter table public.channel_memberships add constraint channel_memberships_pkey primary key (channel_id, user_id);
alter table public.channels add constraint channels_pkey primary key (id);
alter table public.direct_thread_participants add constraint direct_thread_participants_pkey primary key (thread_id, user_id);
alter table public.direct_threads add constraint direct_threads_pkey primary key (id);
alter table public.events add constraint events_pkey primary key (id);
alter table public.invites add constraint invites_pkey primary key (id);
alter table public.itineraries add constraint itineraries_pkey primary key (id);
alter table public.itinerary_items add constraint itinerary_items_pkey primary key (id);
alter table public.messages add constraint messages_pkey primary key (id);
alter table public.post_reactions add constraint post_reactions_pkey primary key (post_id, user_id);
alter table public.posts add constraint posts_pkey primary key (id);
alter table public.profiles add constraint profiles_pkey primary key (id);
alter table public.rd_applications add constraint rd_applications_pkey primary key (id);
alter table public.reports add constraint reports_pkey primary key (id);
alter table public.rsvps add constraint rsvps_pkey primary key (user_id, event_id);
alter table public.verification_records add constraint verification_records_pkey primary key (id);

alter table public.business_members add constraint business_members_business_id_user_id_key unique (business_id, user_id);
alter table public.channels add constraint channels_slug_key unique (slug);

alter table public.access_purchases add constraint access_purchases_provider_type_check check (provider_type = any (array['business'::text, 'user'::text]));
alter table public.access_purchases add constraint access_purchases_status_check check (status = any (array['pending'::text, 'paid'::text, 'refunded'::text]));
alter table public.business_members add constraint business_members_role_check check (role = any (array['owner'::text, 'professional'::text, 'assistant'::text, 'employee'::text]));
alter table public.business_members add constraint business_members_status_check check (status = any (array['invited'::text, 'active'::text]));
alter table public.business_members add constraint business_members_verified_via_check check (verified_via = any (array['self'::text, 'business'::text]));
alter table public.businesses add constraint businesses_verification_status_check check (verification_status = any (array['unverified'::text, 'verified'::text]));
alter table public.businesses add constraint secondary_not_primary check (not (primary_sector = any (secondary_sectors)));
alter table public.businesses add constraint secondary_sectors_max_2 check ((array_length(secondary_sectors, 1) is null) or (array_length(secondary_sectors, 1) <= 2));
alter table public.events add constraint events_mode_check check (mode = any (array['in_person'::text, 'online'::text]));
alter table public.events add constraint events_view_check check (view = any (array['us'::text, 'nepal'::text, 'bridge'::text]));
alter table public.invites add constraint invites_role_check check (role = any (array['professional'::text, 'assistant'::text, 'employee'::text]));
alter table public.invites add constraint invites_status_check check (status = any (array['pending'::text, 'accepted'::text, 'expired'::text]));
alter table public.invites add constraint invites_type_check check (type = any (array['business_member'::text, 'vouch'::text]));
alter table public.itineraries add constraint itineraries_group_size_check check ((group_size is null) or (group_size > 0));
alter table public.itineraries add constraint itineraries_view_check check (view = any (array['us'::text, 'nepal'::text, 'bridge'::text]));
alter table public.itinerary_items add constraint itinerary_items_category_check check (category = any (array['stay'::text, 'activity'::text, 'transport'::text, 'food'::text, 'other'::text]));
alter table public.itinerary_items add constraint itinerary_items_day_check check (day >= 1);
alter table public.messages add constraint messages_check check ((channel_id is not null) or (thread_id is not null));
alter table public.posts add constraint posts_posted_as_check check (posted_as = any (array['user'::text, 'business'::text]));
alter table public.posts add constraint posts_view_check check (view = any (array['us'::text, 'nepal'::text, 'bridge'::text]));
alter table public.profiles add constraint profiles_country_check check (country = any (array['us'::text, 'nepal'::text]));
alter table public.profiles add constraint profiles_np_verification_check check (np_verification = any (array['none'::text, 'pending'::text, 'verified'::text, 'rejected'::text, 'revoked'::text]));
alter table public.profiles add constraint profiles_oauth_provider_check check (oauth_provider = any (array['google'::text, 'apple'::text, 'email'::text, 'phone'::text]));
alter table public.profiles add constraint profiles_special_badge_check check (special_badge = 'diplomat'::text);
alter table public.profiles add constraint profiles_us_verification_check check (us_verification = any (array['none'::text, 'pending'::text, 'verified'::text, 'rejected'::text, 'revoked'::text]));
alter table public.rd_applications add constraint rd_applications_incorporation_status_check check (incorporation_status = any (array['none'::text, 'nepal_pvt_ltd'::text, 'us_entity'::text, 'both'::text, 'other'::text]));
alter table public.rd_applications add constraint rd_applications_stage_check check (stage = any (array['idea'::text, 'prototype'::text, 'revenue'::text, 'scaling'::text]));
alter table public.rd_applications add constraint rd_applications_status_check check (status = any (array['submitted'::text, 'screening'::text, 'accepted'::text, 'rejected'::text, 'withdrawn'::text]));
alter table public.reports add constraint reports_status_check check (status = any (array['open'::text, 'actioned'::text, 'dismissed'::text]));
alter table public.verification_records add constraint verification_records_policy_track_check check (policy_track = any (array['us'::text, 'nepal'::text]));
alter table public.verification_records add constraint verification_records_status_check check (status = any (array['pending'::text, 'passed'::text, 'failed'::text]));
alter table public.verification_records add constraint verification_records_subject_type_check check (subject_type = any (array['user'::text, 'business'::text]));

-- ---------------------------------------------------------------------
-- 3. Foreign keys (all tables exist now)
-- ---------------------------------------------------------------------
alter table public.access_purchases add constraint access_purchases_buyer_user_id_fkey foreign key (buyer_user_id) references public.profiles(id) on delete cascade;
alter table public.admin_users add constraint admin_users_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.audit_logs add constraint audit_logs_actor_id_fkey foreign key (actor_id) references public.profiles(id);
alter table public.business_members add constraint business_members_added_by_fkey foreign key (added_by) references public.profiles(id);
alter table public.business_members add constraint business_members_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.business_members add constraint business_members_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.businesses add constraint businesses_owner_user_id_fkey foreign key (owner_user_id) references public.profiles(id) on delete cascade;
alter table public.channel_memberships add constraint channel_memberships_channel_id_fkey foreign key (channel_id) references public.channels(id) on delete cascade;
alter table public.channel_memberships add constraint channel_memberships_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.channels add constraint channels_owner_user_id_fkey foreign key (owner_user_id) references public.profiles(id);
alter table public.direct_thread_participants add constraint direct_thread_participants_thread_id_fkey foreign key (thread_id) references public.direct_threads(id) on delete cascade;
alter table public.direct_thread_participants add constraint direct_thread_participants_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.events add constraint events_host_id_fkey foreign key (host_id) references public.profiles(id);
alter table public.invites add constraint invites_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.invites add constraint invites_from_user_id_fkey foreign key (from_user_id) references public.profiles(id);
alter table public.itineraries add constraint itineraries_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.itinerary_items add constraint itinerary_items_business_id_fkey foreign key (business_id) references public.businesses(id) on delete set null;
alter table public.itinerary_items add constraint itinerary_items_itinerary_id_fkey foreign key (itinerary_id) references public.itineraries(id) on delete cascade;
alter table public.messages add constraint messages_channel_id_fkey foreign key (channel_id) references public.channels(id) on delete cascade;
alter table public.messages add constraint messages_sender_id_fkey foreign key (sender_id) references public.profiles(id) on delete cascade;
alter table public.messages add constraint messages_thread_id_fkey foreign key (thread_id) references public.direct_threads(id) on delete cascade;
alter table public.post_reactions add constraint post_reactions_post_id_fkey foreign key (post_id) references public.posts(id) on delete cascade;
alter table public.post_reactions add constraint post_reactions_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.posts add constraint posts_author_id_fkey foreign key (author_id) references public.profiles(id) on delete cascade;
alter table public.posts add constraint posts_business_id_fkey foreign key (business_id) references public.businesses(id) on delete set null;
alter table public.posts add constraint posts_channel_id_fkey foreign key (channel_id) references public.channels(id) on delete set null;
alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table public.rd_applications add constraint rd_applications_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.reports add constraint reports_reporter_id_fkey foreign key (reporter_id) references public.profiles(id);
alter table public.reports add constraint reports_reviewer_id_fkey foreign key (reviewer_id) references public.profiles(id);
alter table public.rsvps add constraint rsvps_event_id_fkey foreign key (event_id) references public.events(id) on delete cascade;
alter table public.rsvps add constraint rsvps_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.verification_records add constraint verification_records_reviewer_id_fkey foreign key (reviewer_id) references public.profiles(id);

-- ---------------------------------------------------------------------
-- 4. Secondary indexes (constraint-backed indexes are created above)
-- ---------------------------------------------------------------------
create index business_members_user_id_idx on public.business_members using btree (user_id);
create index businesses_owner_user_id_idx on public.businesses using btree (owner_user_id);
create index businesses_sector_idx on public.businesses using btree (primary_sector);
create index itineraries_user_id_created_at_idx on public.itineraries using btree (user_id, created_at desc);
create index itinerary_items_business_id_idx on public.itinerary_items using btree (business_id);
create index itinerary_items_itinerary_id_day_sort_order_idx on public.itinerary_items using btree (itinerary_id, day, sort_order);
create index messages_channel_id_created_at_idx on public.messages using btree (channel_id, created_at);
create index messages_thread_id_created_at_idx on public.messages using btree (thread_id, created_at);
create index post_reactions_post_id_idx on public.post_reactions using btree (post_id);
create index posts_created_at_idx on public.posts using btree (created_at desc);
create index profiles_bridge_idx on public.profiles using btree (bridge) where bridge;
create index rd_applications_status_idx on public.rd_applications using btree (status);
create index rd_applications_user_idx on public.rd_applications using btree (user_id);

-- ---------------------------------------------------------------------
-- 5. Functions (private helpers first — later definitions depend on them)
-- ---------------------------------------------------------------------
create or replace function private.is_admin()
  returns boolean language sql stable security definer set search_path to 'public'
  as $fn$ select exists (select 1 from public.admin_users where user_id = auth.uid()); $fn$;

create or replace function private.is_thread_participant(p_thread uuid)
  returns boolean language sql stable security definer set search_path to 'public'
  as $fn$ select exists (select 1 from public.direct_thread_participants where thread_id = p_thread and user_id = auth.uid()); $fn$;

create or replace function private.is_trusted_writer()
  returns boolean language sql stable set search_path to 'public'
  as $fn$ select auth.uid() is null or private.is_admin(); $fn$;

create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path to 'public'
  as $fn$
begin
  insert into public.profiles (id, name, avatar_url, oauth_provider)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_app_meta_data->>'provider', 'email')
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;

create or replace function public.find_user_id_by_email(lookup_email text)
  returns uuid language plpgsql security definer set search_path to 'public'
  as $fn$
declare
  found_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select id into found_id from auth.users where lower(email) = lower(lookup_email) limit 1;
  return found_id;
end;
$fn$;

create or replace function public.get_or_create_direct_thread(other_user_id uuid)
  returns uuid language plpgsql security definer set search_path to 'public'
  as $fn$
declare
  existing_thread_id uuid;
  new_thread_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if auth.uid() = other_user_id then
    raise exception 'Cannot start a thread with yourself';
  end if;

  select p1.thread_id into existing_thread_id
  from public.direct_thread_participants p1
  join public.direct_thread_participants p2 on p1.thread_id = p2.thread_id
  where p1.user_id = auth.uid() and p2.user_id = other_user_id
  limit 1;

  if existing_thread_id is not null then
    return existing_thread_id;
  end if;

  insert into public.direct_threads default values returning id into new_thread_id;
  insert into public.direct_thread_participants (thread_id, user_id) values
    (new_thread_id, auth.uid()),
    (new_thread_id, other_user_id);

  return new_thread_id;
end;
$fn$;

create or replace function public.redeem_business_invite(invite_id uuid)
  returns boolean language plpgsql security definer set search_path to 'public'
  as $fn$
declare
  inv record;
  caller_email text;
begin
  select email into caller_email from auth.users where id = auth.uid();
  if caller_email is null then
    return false;
  end if;

  select * into inv from public.invites
  where id = invite_id
    and type = 'business_member'
    and status = 'pending'
    and lower(target) = lower(caller_email)
    and (expires_at is null or expires_at > now());

  if not found then
    return false;
  end if;

  insert into public.business_members (business_id, user_id, role, status, can_post, verified_via, added_by)
  values (inv.business_id, auth.uid(), coalesce(inv.role, 'employee'), 'active', inv.can_post, 'business', inv.from_user_id)
  on conflict (business_id, user_id) do nothing;

  update public.invites set status = 'accepted', used_at = now() where id = inv.id;
  return true;
end;
$fn$;

-- Trust-column guards: pin admin-only columns for non-privileged writers.
create or replace function public.protect_profile_trust_columns()
  returns trigger language plpgsql set search_path to 'public'
  as $fn$
begin
  if private.is_trusted_writer() then return new; end if;
  if tg_op = 'INSERT' then
    new.us_verification := 'none';
    new.np_verification := 'none';
    new.us_verified_at  := null;
    new.np_verified_at  := null;
    new.special_badge   := null;
  else
    new.us_verification := old.us_verification;
    new.np_verification := old.np_verification;
    new.us_verified_at  := old.us_verified_at;
    new.np_verified_at  := old.np_verified_at;
    new.special_badge   := old.special_badge;
  end if;
  return new;
end; $fn$;

create or replace function public.protect_business_trust_columns()
  returns trigger language plpgsql set search_path to 'public'
  as $fn$
begin if private.is_trusted_writer() then return new; end if;
  if tg_op='INSERT' then new.verification_status:='unverified'; new.verified_at:=null; new.is_paid_provider:=false;
  else new.verification_status:=old.verification_status; new.verified_at:=old.verified_at; new.is_paid_provider:=old.is_paid_provider; end if; return new; end $fn$;

create or replace function public.protect_rd_status()
  returns trigger language plpgsql set search_path to 'public'
  as $fn$
begin if private.is_trusted_writer() then return new; end if;
  if tg_op='INSERT' then new.status:='submitted'; new.reviewer_notes:=null;
  else new.status:=old.status; new.reviewer_notes:=old.reviewer_notes; end if; return new; end $fn$;

create or replace function public.protect_verification_status()
  returns trigger language plpgsql set search_path to 'public'
  as $fn$
begin if private.is_trusted_writer() then return new; end if;
  if tg_op='INSERT' then new.status:='pending'; new.reviewer_id:=null;
  else new.status:=old.status; new.reviewer_id:=old.reviewer_id; end if; return new; end $fn$;

create or replace function public.protect_dtp_identity()
  returns trigger language plpgsql set search_path to 'public'
  as $fn$
begin
  new.thread_id := old.thread_id;
  new.user_id   := old.user_id;
  return new;
end $fn$;

-- ---------------------------------------------------------------------
-- 6. Triggers
-- ---------------------------------------------------------------------
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
create trigger trg_protect_profile_trust before insert or update on public.profiles
  for each row execute function public.protect_profile_trust_columns();
create trigger trg_protect_business_trust before insert or update on public.businesses
  for each row execute function public.protect_business_trust_columns();
create trigger trg_protect_rd_status before insert or update on public.rd_applications
  for each row execute function public.protect_rd_status();
create trigger trg_protect_verification_status before insert or update on public.verification_records
  for each row execute function public.protect_verification_status();
create trigger trg_protect_dtp_identity before update on public.direct_thread_participants
  for each row execute function public.protect_dtp_identity();

-- ---------------------------------------------------------------------
-- 7. Row Level Security — enable on every table, then policies
-- ---------------------------------------------------------------------
alter table public.access_purchases enable row level security;
alter table public.admin_users enable row level security;
alter table public.audit_logs enable row level security;
alter table public.business_members enable row level security;
alter table public.businesses enable row level security;
alter table public.channel_memberships enable row level security;
alter table public.channels enable row level security;
alter table public.direct_thread_participants enable row level security;
alter table public.direct_threads enable row level security;
alter table public.events enable row level security;
alter table public.invites enable row level security;
alter table public.itineraries enable row level security;
alter table public.itinerary_items enable row level security;
alter table public.messages enable row level security;
alter table public.post_reactions enable row level security;
alter table public.posts enable row level security;
alter table public.profiles enable row level security;
alter table public.rd_applications enable row level security;
alter table public.reports enable row level security;
alter table public.rsvps enable row level security;
alter table public.verification_records enable row level security;

-- access_purchases
create policy access_purchases_insert_own on public.access_purchases for insert to authenticated with check (buyer_user_id = auth.uid());
create policy access_purchases_select_own on public.access_purchases for select to authenticated using (buyer_user_id = auth.uid());
-- admin_users
create policy admin_users_select_self on public.admin_users for select to authenticated using (user_id = auth.uid());
-- audit_logs
create policy audit_logs_admin_select on public.audit_logs for select to authenticated using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy audit_logs_insert_self on public.audit_logs for insert to authenticated with check (actor_id = auth.uid());
-- business_members
create policy business_members_select on public.business_members for select to authenticated using (true);
create policy business_members_write_owner on public.business_members for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_members.business_id and b.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_members.business_id and b.owner_user_id = auth.uid()));
-- businesses
create policy businesses_admin_update on public.businesses for update to authenticated using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy businesses_delete_owner on public.businesses for delete to authenticated using (owner_user_id = auth.uid());
create policy businesses_insert_owner on public.businesses for insert to authenticated with check (owner_user_id = auth.uid());
create policy businesses_select on public.businesses for select to authenticated using (true);
create policy businesses_update_owner on public.businesses for update to authenticated using (owner_user_id = auth.uid());
-- channel_memberships
create policy channel_memberships_delete_own on public.channel_memberships for delete to authenticated using (user_id = auth.uid());
create policy channel_memberships_insert_own on public.channel_memberships for insert to authenticated
  with check ((user_id = auth.uid()) and exists (select 1 from public.channels c where c.id = channel_memberships.channel_id and c.is_private = false and c.min_tier is null));
create policy channel_memberships_select on public.channel_memberships for select to authenticated using (true);
-- channels
create policy channels_select on public.channels for select to authenticated using (true);
-- direct_thread_participants
create policy dtp_select_own on public.direct_thread_participants for select to authenticated using (private.is_thread_participant(thread_id));
create policy dtp_update_own on public.direct_thread_participants for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- direct_threads
create policy direct_threads_select_participant on public.direct_threads for select to authenticated using (private.is_thread_participant(id));
-- events
create policy events_insert_host on public.events for insert to authenticated with check (host_id = auth.uid());
create policy events_select on public.events for select to authenticated using (true);
-- invites  (insert policy is granted to PUBLIC in prod)
create policy invites_insert_owner on public.invites for insert to public
  with check ((type = 'business_member') and (from_user_id = auth.uid()) and exists (select 1 from public.businesses b where b.id = invites.business_id and b.owner_user_id = auth.uid()));
create policy invites_select_related on public.invites for select to authenticated
  using ((from_user_id = auth.uid()) or ((business_id is not null) and exists (select 1 from public.businesses b where b.id = invites.business_id and b.owner_user_id = auth.uid())));
-- itineraries  (owner-only, granted to PUBLIC role in prod)
create policy itineraries_delete_own on public.itineraries for delete to public using (user_id = auth.uid());
create policy itineraries_insert_own on public.itineraries for insert to public with check (user_id = auth.uid());
create policy itineraries_select_own on public.itineraries for select to public using (user_id = auth.uid());
create policy itineraries_update_own on public.itineraries for update to public using (user_id = auth.uid());
-- itinerary_items  (owner-of-parent, granted to PUBLIC role in prod)
create policy itinerary_items_delete_own on public.itinerary_items for delete to public using (exists (select 1 from public.itineraries i where i.id = itinerary_items.itinerary_id and i.user_id = auth.uid()));
create policy itinerary_items_insert_own on public.itinerary_items for insert to public with check (exists (select 1 from public.itineraries i where i.id = itinerary_items.itinerary_id and i.user_id = auth.uid()));
create policy itinerary_items_select_own on public.itinerary_items for select to public using (exists (select 1 from public.itineraries i where i.id = itinerary_items.itinerary_id and i.user_id = auth.uid()));
create policy itinerary_items_update_own on public.itinerary_items for update to public using (exists (select 1 from public.itineraries i where i.id = itinerary_items.itinerary_id and i.user_id = auth.uid()));
-- messages
create policy messages_insert_sender on public.messages for insert to authenticated
  with check ((sender_id = auth.uid()) and (((channel_id is not null) and (thread_id is null) and exists (select 1 from public.channel_memberships cm where cm.channel_id = messages.channel_id and cm.user_id = auth.uid())) or ((thread_id is not null) and (channel_id is null) and private.is_thread_participant(thread_id))));
create policy messages_select_participant on public.messages for select to authenticated
  using (((channel_id is not null) and exists (select 1 from public.channel_memberships cm where cm.channel_id = messages.channel_id and cm.user_id = auth.uid())) or ((thread_id is not null) and private.is_thread_participant(thread_id)));
-- post_reactions
create policy post_reactions_delete_own on public.post_reactions for delete to authenticated using (user_id = auth.uid());
create policy post_reactions_insert_own on public.post_reactions for insert to authenticated with check (user_id = auth.uid());
create policy post_reactions_select on public.post_reactions for select to authenticated using (true);
-- posts
create policy posts_delete_own on public.posts for delete to authenticated using (author_id = auth.uid());
create policy posts_insert_own on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy posts_select on public.posts for select to authenticated using (true);
create policy posts_update_own on public.posts for update to authenticated using (author_id = auth.uid());
-- profiles
create policy profiles_admin_update on public.profiles for update to authenticated using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid());
-- rd_applications  (granted to PUBLIC role in prod)
create policy rd_apps_insert_own on public.rd_applications for insert to public with check (user_id = auth.uid());
create policy rd_apps_select_own_or_admin on public.rd_applications for select to public using ((user_id = auth.uid()) or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy rd_apps_update_admin on public.rd_applications for update to public using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy rd_apps_update_own on public.rd_applications for update to public using (user_id = auth.uid()) with check (user_id = auth.uid());
-- reports
create policy reports_admin_all on public.reports for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy reports_insert_own on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_select_own on public.reports for select to authenticated using (reporter_id = auth.uid());
-- rsvps
create policy rsvps_delete_own on public.rsvps for delete to authenticated using (user_id = auth.uid());
create policy rsvps_insert_own on public.rsvps for insert to authenticated with check (user_id = auth.uid());
create policy rsvps_select on public.rsvps for select to authenticated using (true);
-- verification_records
-- NB: granted to PUBLIC in prod (not `authenticated`) — the WITH CHECK still
-- pins subject to auth.uid(), so an anonymous caller cannot insert.
create policy verification_insert_own on public.verification_records for insert to public
  with check (((subject_type = 'user') and (subject_id = auth.uid())) or ((subject_type = 'business') and exists (select 1 from public.businesses b where b.id = verification_records.subject_id and b.owner_user_id = auth.uid())));
create policy verification_records_admin_all on public.verification_records for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy verification_select_own on public.verification_records for select to authenticated
  using (((subject_type = 'user') and (subject_id = auth.uid())) or ((subject_type = 'business') and exists (select 1 from public.businesses b where b.id = verification_records.subject_id and b.owner_user_id = auth.uid())));

-- ---------------------------------------------------------------------
-- 8. Function EXECUTE privileges (match prod's non-default ACLs)
--    Default privileges leave protect_* callable by PUBLIC — intentional
--    (they are trigger-only), so they are not re-granted here.
-- ---------------------------------------------------------------------
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated, service_role;
revoke all on function private.is_thread_participant(uuid) from public, anon;
grant execute on function private.is_thread_participant(uuid) to authenticated, service_role;
revoke all on function private.is_trusted_writer() from public, anon;
grant execute on function private.is_trusted_writer() to authenticated, service_role;

revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;

revoke all on function public.get_or_create_direct_thread(uuid) from public, anon;
grant execute on function public.get_or_create_direct_thread(uuid) to authenticated, service_role;

revoke all on function public.redeem_business_invite(uuid) from public, anon;
grant execute on function public.redeem_business_invite(uuid) to authenticated, service_role;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;

-- ---------------------------------------------------------------------
-- NOTES for the acceptance run (things `db diff --linked` may still surface):
--   1. TABLE grants: prod tables are readable/writable by anon/authenticated/
--      service_role via Supabase's public-schema DEFAULT PRIVILEGES, applied by
--      the platform when a table is created in `public`. They are intentionally
--      NOT emitted here (a local stack applies the same defaults). If db diff
--      reports missing/extra table grants, add explicit GRANTs to match.
--   2. Function ACLs above are reconstructed from pg_proc.proacl. If db diff
--      flags a grant delta, reconcile against the observed ACL.
--   3. Comments on the two keep-but-scope RPCs (get_or_create_direct_thread,
--      redeem_business_invite) from migration 20260722152629 are omitted; add
--      the COMMENT ON FUNCTION statements if you want them in the baseline.
-- =====================================================================
