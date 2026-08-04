-- ROLLBACK for BL-TRUST-01 — TRUE INVERSE. Restores both insert policies to their EXACT
-- pre-migration form (bare auth.uid(), ORIGINAL role lists) and drops the helper.
--
-- Pre-migration state (verified live 2026-08-04):
--   posts_insert_own         = {authenticated}, with_check (author_id = auth.uid())
--   post_comments_insert_own = {public},        with_check (author_id = auth.uid())
--
-- ORDER MATTERS: restore the policies FIRST (removing every reference to
-- private.can_write_content()), THEN drop the function — Postgres refuses to drop a function
-- a live policy still depends on.

drop policy posts_insert_own on public.posts;
create policy posts_insert_own on public.posts
  for insert to authenticated
  with check (author_id = auth.uid());

drop policy post_comments_insert_own on public.post_comments;
create policy post_comments_insert_own on public.post_comments
  for insert to public
  with check (author_id = auth.uid());

drop function if exists private.can_write_content();
