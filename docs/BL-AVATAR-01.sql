-- BL-AVATAR-01 — avatars/logos storage bucket + policies.
--
-- WHY: the feed / directory / team-lists / sidebar ALREADY render avatar_url / logo_url
-- (PostCard, Avatar, MemberCard, BusinessCard, Sidebar, …) but nothing in the app ever WROTE
-- them — no bucket, no upload UI, no storage policy. Measured live 2026-08-04: 2/36 profiles
-- have an avatar (OAuth imports), 0/16 businesses have a logo, 0/14 feed authors show a photo.
-- This builds the WRITE path; the feed lights up with ZERO feed changes.
--
-- PUBLIC BUCKET (a deliberate departure from post-media / message-attachments, both private):
--   - Avatars render in every feed row / comment / card / team-list / sidebar. Minting a signed
--     URL per avatar per render is a large per-page cost, and signed URLs expire so they defeat
--     browser/CDN caching. A public bucket serves a stable, cacheable URL.
--   - Object keys are UUID-based (unguessable); a URL is only learned by reading the
--     profile/business row, which is already RLS-gated (private.can_view_profile, D-025).
--   - TRADE-OFF (stated, not hidden): a leaked avatar URL is publicly fetchable forever.
--     Acceptable for a profile photo; it would NOT be for a KYC document. If KC prefers private
--     + signed URLs, that is a one-line bucket change (public => false) + a signing route —
--     FLAGGED, not decided here.
--
-- KEY LAYOUT — the path prefix carries the owner so storage RLS can check it
-- (foldername[1] = kind, [2] = owner):
--     avatars/user/{user_id}/{uuid}.{ext}     avatars/business/{business_id}/{uuid}.{ext}
--
-- Business logos are OWNER-ONLY (businesses.owner_user_id = auth.uid()), mirroring
-- events_insert_host / the offerings policies — NOT business_members. Org-logo editing by a
-- non-owner member is a separate decision, NOT widened here.
--
-- Content type is decided SERVER-SIDE by MAGIC BYTES in the upload route /api/avatar (D-052,
-- reusing lib/attachmentSniff.ts) — allowed_mime_types below is only a coarse first filter.
-- NO GIF (animated avatars in a professional directory are an unrequested moderation surface).
--
-- COMMIT this file; DO NOT APPLY it. The hub verifies BL-AVATAR-01.verify.sql in a
-- begin/rollback against prod, then applies.

-- 1. Bucket. 2 MB is generous post-resize (the client downscales to a 512x512 webp, typically
--    < 100 KB). public = true.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- 2. Ownership predicate for the storage policies — mirrors the private.is_thread_participant
--    pattern used by message-attachments (a SECURITY DEFINER private helper called from the
--    storage.objects RLS). Reads only whether the CALLER owns the path; leaks nothing.
--    'user'     → path segment 2 is the caller's own uid.
--    'business' → path segment 2 is a business the caller OWNS (owner_user_id), not a member of.
--    any other prefix → false.
create or replace function private.can_write_avatar(object_name text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select case (storage.foldername(object_name))[1]
    when 'user' then (storage.foldername(object_name))[2] = (select auth.uid())::text
    when 'business' then exists (
      select 1 from businesses b
      where b.id = nullif((storage.foldername(object_name))[2], '')::uuid
        and b.owner_user_id = (select auth.uid())
    )
    else false
  end;
$$;

-- Grant hygiene (D-057): the storage.objects RLS runs as the authenticated role, so it must be
-- able to call the helper. Revoke the default PUBLIC grant, grant only authenticated.
revoke execute on function private.can_write_avatar(text) from public, anon, authenticated;
grant  execute on function private.can_write_avatar(text) to authenticated;

-- 3. Storage RLS on storage.objects for bucket_id = 'avatars'.
--    NO SELECT policy by design: a public bucket serves object URLs WITHOUT RLS, so none is
--    needed for rendering, and a broad `for select using (bucket_id='avatars')` would let any
--    authenticated client LIST every object key — enumerating user/business ids, including
--    those of PRIVATE profiles hidden by can_view_profile (advisor
--    public_bucket_allows_listing). The app never lists avatars. (An owner-scoped SELECT can
--    be added later if a list-own-objects need ever arises.)
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and private.can_write_avatar(name));

create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and private.can_write_avatar(name))
  with check (bucket_id = 'avatars' and private.can_write_avatar(name));

create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and private.can_write_avatar(name));
