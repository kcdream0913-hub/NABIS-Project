-- Rollback for 20260728090000_feed_social_actions.
-- Destructive: drops all comments, reposts, bookmarks, share records and post media
-- references. Uploaded objects in the post-media bucket are NOT deleted.

do $$
begin
  if exists (select 1 from pg_publication_tables
             where pubname='supabase_realtime' and schemaname='public' and tablename='post_comments')
  then alter publication supabase_realtime drop table public.post_comments; end if;
  if exists (select 1 from pg_publication_tables
             where pubname='supabase_realtime' and schemaname='public' and tablename='post_reactions')
  then alter publication supabase_realtime drop table public.post_reactions; end if;
end $$;

drop policy if exists post_media_delete_own on storage.objects;
drop policy if exists post_media_insert_own on storage.objects;
drop policy if exists post_media_read      on storage.objects;

drop trigger  if exists trg_validate_post_media on public.posts;
drop function if exists public.validate_post_media();
alter table public.posts drop constraint if exists posts_media_shape_check;
alter table public.posts drop column if exists media;

drop table if exists public.post_shares;
drop table if exists public.post_bookmarks;

drop trigger  if exists trg_enforce_repost_view on public.post_reposts;
drop function if exists public.enforce_repost_view();
drop table if exists public.post_reposts;

drop trigger  if exists trg_protect_post_comment_columns on public.post_comments;
drop trigger  if exists trg_enforce_comment_depth        on public.post_comments;
drop function if exists public.protect_post_comment_columns();
drop function if exists public.enforce_comment_depth();
drop table if exists public.post_comments;

alter table public.post_reactions drop constraint if exists post_reactions_kind_check;
alter table public.post_reactions drop column if exists kind;
