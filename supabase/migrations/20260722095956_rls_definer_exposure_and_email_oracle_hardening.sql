-- BridgeLink v3 — Defense-in-depth: SECURITY DEFINER RPC exposure + email->uid oracle
-- Moves RLS helper functions out of the API-exposed public schema into `private`
-- (OIDs preserved via ALTER ... SET SCHEMA, so OID-bound policies keep working),
-- tightens EXECUTE to least-privilege, and closes find_user_id_by_email for end users.

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- Relocate helpers so PostgREST no longer exposes them as /rest/v1/rpc endpoints.
alter function public.is_admin() set schema private;
alter function public.is_thread_participant(uuid) set schema private;
alter function public.is_trusted_writer() set schema private;

-- is_trusted_writer referenced public.is_admin() by qualified name; repoint to private.
create or replace function private.is_trusted_writer() returns boolean
  language sql stable set search_path to 'public'
  as $$ select auth.uid() is null or private.is_admin(); $$;

-- Trigger functions referenced public.is_trusted_writer() by qualified name; repoint to private.
create or replace function public.protect_profile_trust_columns() returns trigger language plpgsql set search_path to 'public' as $$
begin if private.is_trusted_writer() then return new; end if;
  if tg_op='INSERT' then new.verification_status:='unverified'; new.verified_at:=null; new.special_badge:=null;
  else new.verification_status:=old.verification_status; new.verified_at:=old.verified_at; new.special_badge:=old.special_badge; end if; return new; end $$;

create or replace function public.protect_business_trust_columns() returns trigger language plpgsql set search_path to 'public' as $$
begin if private.is_trusted_writer() then return new; end if;
  if tg_op='INSERT' then new.verification_status:='unverified'; new.verified_at:=null; new.is_paid_provider:=false;
  else new.verification_status:=old.verification_status; new.verified_at:=old.verified_at; new.is_paid_provider:=old.is_paid_provider; end if; return new; end $$;

create or replace function public.protect_rd_status() returns trigger language plpgsql set search_path to 'public' as $$
begin if private.is_trusted_writer() then return new; end if;
  if tg_op='INSERT' then new.status:='submitted'; new.reviewer_notes:=null;
  else new.status:=old.status; new.reviewer_notes:=old.reviewer_notes; end if; return new; end $$;

create or replace function public.protect_verification_status() returns trigger language plpgsql set search_path to 'public' as $$
begin if private.is_trusted_writer() then return new; end if;
  if tg_op='INSERT' then new.status:='pending'; new.reviewer_id:=null;
  else new.status:=old.status; new.reviewer_id:=old.reviewer_id; end if; return new; end $$;

-- Least-privilege: helpers callable only by the roles that need them internally.
revoke execute on function private.is_admin() from public, anon;
revoke execute on function private.is_thread_participant(uuid) from public, anon;
revoke execute on function private.is_trusted_writer() from public, anon;

-- F8: close the email -> user-id oracle for end users. No internal callers.
-- service_role retained for any legitimate server-side / Edge Function use.
revoke execute on function public.find_user_id_by_email(text) from public, anon, authenticated;
