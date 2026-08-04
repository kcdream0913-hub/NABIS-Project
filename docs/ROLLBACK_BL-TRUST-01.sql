-- ROLLBACK for BL-TRUST-01 (v2) — TRUE INVERSE. Restores the 3 insert policies to their EXACT
-- pre-migration form (bare auth.uid(), ORIGINAL role lists), removes the two UPDATE guards, and
-- drops the helper.
--
-- Pre-migration state (verified live 2026-08-04):
--   posts_insert_own         = {authenticated}, with_check (author_id = auth.uid())
--   post_comments_insert_own = {public},        with_check (author_id = auth.uid())
--   post_reposts_insert_own  = {public},        with_check (user_id  = auth.uid())
--   posts UPDATE: no trg_protect_post_body_edits trigger; posts_update_own has no with_check.
--   post_comments UPDATE: protect_post_comment_columns() had NO verification check.
--
-- ORDER MATTERS: remove every reference to private.can_write_content() (the 3 policies, the
-- posts trigger function, the comment trigger function) BEFORE dropping the function.

-- 1. Restore the 3 insert policies (removes their references to can_write_content).
drop policy posts_insert_own on public.posts;
create policy posts_insert_own on public.posts
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy post_comments_insert_own on public.post_comments;
create policy post_comments_insert_own on public.post_comments
  for insert to public
  with check (author_id = auth.uid());

drop policy post_reposts_insert_own on public.post_reposts;
create policy post_reposts_insert_own on public.post_reposts
  for insert to public
  with check (user_id = auth.uid());

-- 2. Drop the posts UPDATE guard (trigger + function).
drop trigger if exists trg_protect_post_body_edits on public.posts;
drop function if exists public.protect_post_body_edits();

-- 3. Restore protect_post_comment_columns() to its EXACT pre-migration definition (the only
--    difference is the removed BL-TRUST-01 verification block).
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
    return new;
  end if;

  if new.body is distinct from old.body then
    if old.created_at < now() - interval '15 minutes' then
      raise exception 'edit window elapsed';
    end if;
    new.edited_at := now();
  end if;

  return new;
end;
$$;

-- 4. Drop the helper (no references remain).
drop function if exists private.can_write_content();
