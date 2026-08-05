-- Signup data persistence (BL-LEGAL-05 §4 + profile population).
--
-- 1) Extend handle_new_user() to copy country + sectors[] from the signup
--    user_metadata into the new profiles row, so a new member appears in the
--    right sector directories immediately (previously only name/avatar/provider
--    were copied; country/sectors sat unused in user_metadata).
--      - country is lower-cased and validated against the profiles.country CHECK
--        ('us' | 'nepal'); anything else becomes NULL rather than failing insert.
--      - sectors is filtered to slugs that correspond to a real sector channel
--        (public.channels.slug), so a stale/forged slug can't land in profiles.
--
-- 2) Append-only consents ledger. There is NO client session at signup (email
--    confirmation is required, mailer_autoconfirm off), so the consent row is
--    written server-side from the trigger using the versioned consent object the
--    signup form already stores in user_metadata. RLS gives owners insert/select
--    on their own rows; there is deliberately no UPDATE or DELETE policy, so the
--    ledger is append-only for authenticated users. The SECURITY DEFINER trigger
--    writes regardless of RLS.
--    `ip` is nullable and left NULL by the trigger: a DB trigger cannot see the
--    end user's request IP. Populating it would require the app/edge layer to
--    pass it explicitly (out of scope here).

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type text not null,        -- 'tos' | 'privacy' (free text: future disclaimers B–E)
  doc_version text not null,     -- e.g. 'v0.2-pilot'
  granted_at timestamptz not null default now(),
  ip text,                       -- nullable; not captured server-side (see header)
  locale text
);

create index if not exists consents_user_id_idx on public.consents (user_id);

alter table public.consents enable row level security;

-- Append-only: owner may insert + read own rows. No UPDATE/DELETE policy exists,
-- so authenticated callers cannot mutate the ledger.
-- auth.uid() is wrapped in a scalar subselect so it is evaluated once per query
-- (not once per row) — avoids the auth_rls_initplan advisory.
drop policy if exists consents_insert_own on public.consents;
create policy consents_insert_own on public.consents
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists consents_select_own on public.consents;
create policy consents_select_own on public.consents
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  raw_country text := lower(nullif(meta->>'country', ''));
  norm_country text := case when raw_country in ('us', 'nepal') then raw_country else null end;
  incoming_sectors text[] := case
    when jsonb_typeof(meta->'sectors') = 'array'
      then array(select jsonb_array_elements_text(meta->'sectors'))
    else '{}'::text[]
  end;
  valid_sectors text[];
  consent jsonb := meta->'consent';
  granted timestamptz := coalesce(nullif(consent->>'at', '')::timestamptz, now());
  loc text := consent->>'locale';
begin
  -- Keep only slugs that map to a real sector channel.
  select coalesce(array_agg(distinct s order by s), '{}'::text[])
    into valid_sectors
    from unnest(incoming_sectors) as s
    where s in (select slug from public.channels);

  insert into public.profiles (id, name, avatar_url, oauth_provider, country, sectors)
  values (
    new.id,
    coalesce(meta->>'name', meta->>'full_name', new.email),
    meta->>'avatar_url',
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    norm_country,
    valid_sectors
  )
  on conflict (id) do nothing;

  -- Append-only consent ledger (BL-LEGAL-05 §4). Two versioned docs at signup.
  if consent ? 'tos' then
    insert into public.consents (user_id, doc_type, doc_version, granted_at, locale)
    values (new.id, 'tos', regexp_replace(consent->>'tos', '^tos_', ''), granted, loc);
  end if;
  if consent ? 'privacy' then
    insert into public.consents (user_id, doc_type, doc_version, granted_at, locale)
    values (new.id, 'privacy', regexp_replace(consent->>'privacy', '^privacy_', ''), granted, loc);
  end if;

  return new;
end;
$function$;
