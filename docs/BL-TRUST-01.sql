-- BL-TRUST-01 — server-side verification gate on user-authored CONTENT.
--
-- WHY: CLAUDE.md's Trust backlog records that the "verified to post" rule was CLIENT-SIDE
-- ONLY. "All features integrate with KYC gating" is a project pillar; server-side the gate
-- did not exist. This migration makes it real for content WITHOUT over-applying to engagement.
--
-- SCOPE (v2 — after the hub's adversarial pass, 2026-08-04, found 3 live bypasses of v1):
--   GATED (creation + mutation of author-written text):
--     - posts INSERT           (verified/admin only)
--     - post_comments INSERT    (verified/admin only)
--     - post_reposts INSERT WHEN it carries a QUOTE  (a quote-repost is publishing wearing an
--       engagement label — v1 left it open and an unverified account published spam through it)
--     - posts UPDATE of `body`          (v1 gated creation but not mutation — an unverified
--     - post_comments UPDATE of `body`   author could rewrite an existing row into spam)
--   LEFT UNGATED (genuine engagement — deliberately, see D-082):
--     - reactions, bookmarks, and BARE reposts (quote is null). Never client-gated; 76% of
--       current reactions are by unverified users; blocking the cheapest engagement action
--       for ~zero abuse value is a live cost pre-critical-mass.
--     - soft-DELETE of one's own comment stays OPEN to unverified users — deleting your own
--       content is not creation, and blocking it would be a worse defect than the one fixed.
--     - editing/deleting is otherwise unchanged; the moderator (post-author) removal path is
--       untouched.
--
-- FLAGGED, NOT gated here (adjacent same-class vectors — a separate decision, like the hub
-- flagged events/offerings/messages): posts.MEDIA edits (an unverified author could swap the
-- media array on an existing post — weaker than body: requires uploading structurally-valid
-- media to storage, no client path). This migration scopes the post UPDATE guard to `body`
-- to match the demonstrated bypass.
--
-- COMMIT this file; DO NOT APPLY it. The hub verifies it in a begin/rollback against prod
-- (see BL-TRUST-01.verify.sql — run the migration then the verify in ONE transaction), then
-- applies. Statements are not wrapped in begin/commit so the verifier can wrap them.
--
-- Verified live 2026-08-04 (read-only): the 5 insert policies, the two UPDATE policies
-- (`posts_update_own` / `post_comments_update_own` — both USING author_id=auth.uid(), and
-- posts_update_own has NO with_check), post_reposts has NO update policy, posts has NO
-- deleted_at column, and the existing `protect_post_comment_columns` BEFORE-UPDATE trigger
-- (its soft-delete path early-returns before the body-edit block — so extending that block
-- cannot affect deletion). `private.can_view_profile`/`is_admin` shape mirrored below;
-- `is_trusted_writer()` inspected and REJECTED (it is `auth.uid() is null or is_admin()` — a
-- service/admin check, not a verification gate). KC 1 (1258b010-…) is unverified + the sole
-- admin_users row — the admin branch keeps the founder able to write.
--
-- NOTE: verification_status is GENERATED (from us_/np_verification); READ only, never write it.

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 1. Verification-gate helper. Same shape as private.can_view_profile: SQL, STABLE, SECURITY
--    DEFINER, search_path 'public'. Reads ONLY the caller's own row (leaks nothing); the admin
--    branch keeps the sole admin (KC) able to write while unverified.
-- ─────────────────────────────────────────────────────────────────────────────────────────
create or replace function private.can_write_content()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    coalesce(
      (select p.verification_status from profiles p where p.id = (select auth.uid())),
      'unverified'
    ) = 'verified'
    or private.is_admin();
$$;

-- Grant hygiene, mirroring can_view_profile ({postgres=X, authenticated=X}). Per D-057 the
-- revoke MUST name public (the default EXECUTE grant is to PUBLIC; naming only anon/
-- authenticated is a silent no-op).
revoke execute on function private.can_write_content() from public, anon, authenticated;
grant  execute on function private.can_write_content() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 2. INSERT gates. AND the verification predicate onto the EXISTING ownership check; use
--    (select auth.uid()) so no 60th auth_rls_initplan WARN. Comments+reposts roles are
--    NORMALISED {public}->{authenticated} (no anon insert path onto user content).
-- ─────────────────────────────────────────────────────────────────────────────────────────
drop policy posts_insert_own on public.posts;
create policy posts_insert_own on public.posts
  for insert to authenticated
  with check ((author_id = (select auth.uid())) and private.can_write_content());

drop policy post_comments_insert_own on public.post_comments;
create policy post_comments_insert_own on public.post_comments
  for insert to authenticated
  with check ((author_id = (select auth.uid())) and private.can_write_content());

-- Finding #1: a QUOTE repost carries author-written text — gate it exactly like a post. A
-- BARE repost (quote is null) stays open to everyone: that is genuine amplification/engagement.
drop policy post_reposts_insert_own on public.post_reposts;
create policy post_reposts_insert_own on public.post_reposts
  for insert to authenticated
  with check (
    (user_id = (select auth.uid()))
    and (quote is null or private.can_write_content())
  );

-- ─────────────────────────────────────────────────────────────────────────────────────────
-- 3. UPDATE (mutation) gates. RLS with_check cannot see OLD, so it cannot tell a body EDIT
--    from a soft-DELETE — a column-level BEFORE-UPDATE guard is required. SECURITY INVOKER
--    (mirrors the existing protect trigger; adds no DEFINER surface). errcode 42501 = the same
--    code an RLS denial raises, so the client handles it identically.
-- ─────────────────────────────────────────────────────────────────────────────────────────

-- Finding #2: posts. No soft-delete (hard-delete only) → no tombstone path to exempt. New
-- trigger; the only other posts trigger (validate_post_media) is UPDATE OF media-scoped.
-- Scoped to `body` to match the demonstrated bypass (posts.media flagged above, not gated).
create or replace function public.protect_post_body_edits()
returns trigger
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  if new.body is distinct from old.body and not private.can_write_content() then
    raise exception 'only verified members may edit content' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_post_body_edits on public.posts;
create trigger trg_protect_post_body_edits
  before update on public.posts
  for each row execute function public.protect_post_body_edits();

-- Finding #3: comments. EXTEND the existing protect_post_comment_columns() (do NOT add a
-- second BEFORE-UPDATE trigger that fights it over `body`). The verification check goes INSIDE
-- the body-edit block, which the soft-delete path early-returns BEFORE reaching — so deleting
-- your own comment stays open to unverified users. The ONLY change vs the live function is the
-- added `if not private.can_write_content()` block (marked BL-TRUST-01); everything else is
-- the current definition verbatim.
create or replace function public.protect_post_comment_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.post_id <> old.post_id
     or new.author_id <> old.author_id
     or new.created_at <> old.created_at
     or new.parent_comment_id is distinct from old.parent_comment_id then
    raise exception 'immutable column on post_comments';
  end if;

  if old.deleted_at is not null then
    raise exception 'comment is deleted';
  end if;

  -- a non-author (i.e. the post author acting as moderator) may only remove
  if auth.uid() is distinct from old.author_id then
    if new.body is distinct from old.body or new.deleted_at is null then
      raise exception 'only the comment author may edit; others may only remove';
    end if;
  end if;

  if new.deleted_at is not null then
    new.body := null;
    new.edited_at := old.edited_at;
    return new;   -- soft-delete path: returns BEFORE the body-edit gate below.
  end if;

  if new.body is distinct from old.body then
    -- BL-TRUST-01: block body EDITS by unverified non-admins. Only reached for non-delete
    -- updates by the author (soft-delete returned above), so deleting your own comment is
    -- unaffected. Placed before the 15-minute window check so an unverified edit is refused
    -- regardless of window.
    if not private.can_write_content() then
      raise exception 'only verified members may edit content' using errcode = '42501';
    end if;
    if old.created_at < now() - interval '15 minutes' then
      raise exception 'edit window elapsed';
    end if;
    new.edited_at := now();
  end if;

  return new;
end;
$$;
