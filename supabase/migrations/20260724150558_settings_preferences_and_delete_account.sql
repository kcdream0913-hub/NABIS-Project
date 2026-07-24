-- Settings Phase A — additive. Applied on a Supabase BRANCH, get_advisors clean,
-- NOT merged to prod until the hub reviews (esp. delete_own_account below).

-- 1) App-managed user preferences (visibility, sharing, timezone, + a notifications
--    block reserved for Phase B). Merge-managed by the app, never clobbered.
--    profiles_update_own is row-level (USING id = auth.uid(), no column scope), so
--    the owner can write this column with no new policy.
alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;

-- 2) Tightly-scoped self-service account deletion. SECURITY DEFINER so it can reach
--    auth.users, but it deletes ONLY the caller's own row (auth.uid()). The FK chain
--    profiles.id -> auth.users(id) and businesses.owner_user_id -> profiles(id), both
--    ON DELETE CASCADE, removes the caller's profile + owned businesses. Executable by
--    authenticated only; revoked from anon/public.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from anon, public;
grant execute on function public.delete_own_account() to authenticated;
