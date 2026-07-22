-- BridgeLink v3 RLS / trust-integrity hardening (F1-F7). Verified via rolled-back simulation 2026-07-21.
create or replace function public.is_admin() returns boolean language sql security definer stable set search_path to 'public' as $fn$ select exists (select 1 from public.admin_users where user_id = auth.uid()); $fn$;
create or replace function public.is_thread_participant(p_thread uuid) returns boolean language sql security definer stable set search_path to 'public' as $fn$ select exists (select 1 from public.direct_thread_participants where thread_id = p_thread and user_id = auth.uid()); $fn$;
create or replace function public.is_trusted_writer() returns boolean language sql stable set search_path to 'public' as $fn$ select auth.uid() is null or public.is_admin(); $fn$;

-- F1: pin profile trust columns for non-admins
create or replace function public.protect_profile_trust_columns() returns trigger language plpgsql security invoker set search_path to 'public' as $fn$ begin if public.is_trusted_writer() then return new; end if; if tg_op='INSERT' then new.verification_status:='unverified'; new.verified_at:=null; new.special_badge:=null; else new.verification_status:=old.verification_status; new.verified_at:=old.verified_at; new.special_badge:=old.special_badge; end if; return new; end; $fn$;
drop trigger if exists trg_protect_profile_trust on public.profiles;
create trigger trg_protect_profile_trust before insert or update on public.profiles for each row execute function public.protect_profile_trust_columns();

-- F2: pin business verification + is_paid_provider for non-admins
create or replace function public.protect_business_trust_columns() returns trigger language plpgsql security invoker set search_path to 'public' as $fn$ begin if public.is_trusted_writer() then return new; end if; if tg_op='INSERT' then new.verification_status:='unverified'; new.verified_at:=null; new.is_paid_provider:=false; else new.verification_status:=old.verification_status; new.verified_at:=old.verified_at; new.is_paid_provider:=old.is_paid_provider; end if; return new; end; $fn$;
drop trigger if exists trg_protect_business_trust on public.businesses;
create trigger trg_protect_business_trust before insert or update on public.businesses for each row execute function public.protect_business_trust_columns();

-- F5: pin R&D application status/reviewer_notes for non-admins
create or replace function public.protect_rd_status() returns trigger language plpgsql security invoker set search_path to 'public' as $fn$ begin if public.is_trusted_writer() then return new; end if; if tg_op='INSERT' then new.status:='submitted'; new.reviewer_notes:=null; else new.status:=old.status; new.reviewer_notes:=old.reviewer_notes; end if; return new; end; $fn$;
drop trigger if exists trg_protect_rd_status on public.rd_applications;
create trigger trg_protect_rd_status before insert or update on public.rd_applications for each row execute function public.protect_rd_status();

-- F6: force client-created verification_records to pending
create or replace function public.protect_verification_status() returns trigger language plpgsql security invoker set search_path to 'public' as $fn$ begin if public.is_trusted_writer() then return new; end if; if tg_op='INSERT' then new.status:='pending'; new.reviewer_id:=null; else new.status:=old.status; new.reviewer_id:=old.reviewer_id; end if; return new; end; $fn$;
drop trigger if exists trg_protect_verification_status on public.verification_records;
create trigger trg_protect_verification_status before insert or update on public.verification_records for each row execute function public.protect_verification_status();

-- F4: break DM recursion by routing participant checks through the SECURITY DEFINER helper
drop policy if exists dtp_select_own on public.direct_thread_participants;
create policy dtp_select_own on public.direct_thread_participants for select to authenticated using (public.is_thread_participant(thread_id));
drop policy if exists direct_threads_select_participant on public.direct_threads;
create policy direct_threads_select_participant on public.direct_threads for select to authenticated using (public.is_thread_participant(id));

-- F3: recursion-free message SELECT + membership-gated message INSERT
drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant on public.messages for select to authenticated using ((channel_id is not null and exists (select 1 from public.channel_memberships cm where cm.channel_id=messages.channel_id and cm.user_id=auth.uid())) or (thread_id is not null and public.is_thread_participant(thread_id)));
drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages for insert to authenticated with check (sender_id=auth.uid() and ((channel_id is not null and thread_id is null and exists (select 1 from public.channel_memberships cm where cm.channel_id=messages.channel_id and cm.user_id=auth.uid())) or (thread_id is not null and channel_id is null and public.is_thread_participant(thread_id))));

-- F7: only allow self-join to open (non-private, un-tiered) channels
drop policy if exists channel_memberships_insert_own on public.channel_memberships;
create policy channel_memberships_insert_own on public.channel_memberships for insert to authenticated with check (user_id=auth.uid() and exists (select 1 from public.channels c where c.id=channel_memberships.channel_id and c.is_private=false and c.min_tier is null));
