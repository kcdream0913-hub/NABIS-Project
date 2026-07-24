-- Visibility enforcement backstop. preferences.visibility ∈ public|bridge|private
-- (absent/unset = public). A profile row is SELECTable by a signed-in viewer when:
--   • it's their own, or
--   • it's public (the default), or
--   • it's bridge-only AND the viewer is verified, or
--   • an existing relationship links them — a shared DM thread or a shared business
--     (member↔member, or owner↔member). This preserves active conversations and
--     team visibility even for private profiles.
-- SECURITY DEFINER (owner has BYPASSRLS) so the internal profiles read does not
-- recurse through this same policy. Lives in the private schema (not exposed via
-- PostgREST). The directory/search/feed queries add the UX-level filtering on top
-- (private never listed; bridge only in Bridge view); this RLS is the security floor.
create or replace function private.can_view_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target = auth.uid()
    -- admins keep full visibility (the review/verification queue reads profiles)
    or exists (select 1 from admin_users a where a.user_id = auth.uid())
    or coalesce((select p.preferences->>'visibility' from profiles p where p.id = target), 'public') = 'public'
    or (
      coalesce((select p.preferences->>'visibility' from profiles p where p.id = target), 'public') = 'bridge'
      and coalesce((select p.verification_status from profiles p where p.id = auth.uid()), 'unverified') = 'verified'
    )
    or exists (
      select 1 from direct_thread_participants a
      join direct_thread_participants b on b.thread_id = a.thread_id
      where a.user_id = auth.uid() and b.user_id = target
    )
    or exists (
      select 1 from business_members m1
      join business_members m2 on m2.business_id = m1.business_id
      where m1.user_id = auth.uid() and m2.user_id = target
    )
    or exists (
      select 1 from businesses bz
      join business_members bm on bm.business_id = bz.id
      where (bz.owner_user_id = auth.uid() and bm.user_id = target)
         or (bz.owner_user_id = target and bm.user_id = auth.uid())
    );
$$;

revoke all on function private.can_view_profile(uuid) from anon, public;
grant execute on function private.can_view_profile(uuid) to authenticated;

alter policy profiles_select on public.profiles
  using ( private.can_view_profile(id) );
