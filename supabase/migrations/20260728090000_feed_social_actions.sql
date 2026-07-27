-- BL-SOCIAL-02: feed social actions (reactions/comments/reposts/shares/bookmarks) + post media
-- Hub-authored 2026-07-27. Applied on a Supabase branch, verified, then merged. Do not apply locally.

-- ---------------------------------------------------------------------------
-- 1. REACTIONS: binary like -> 5-kind reaction, one per user per post
-- ---------------------------------------------------------------------------
alter table public.post_reactions
  add column if not exists kind text not null default 'like';

alter table public.post_reactions drop constraint if exists post_reactions_kind_check;
alter table public.post_reactions add constraint post_reactions_kind_check
  check (kind = any (array['like','celebrate','support','insightful','namaste']));

-- PK stays (post_id, user_id): a user holds exactly one reaction per post and may change it.

-- ---------------------------------------------------------------------------
-- 2. COMMENTS: one level of replies, soft delete only
-- ---------------------------------------------------------------------------
create table if not exists public.post_comments (
  id                uuid primary key default gen_random_uuid(),
  post_id           uuid not null references public.posts(id) on delete cascade,
  author_id         uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.post_comments(id) on delete cascade,
  body              text,
  body_lang         text check (body_lang = any (array['en','ne'])),
  created_at        timestamptz not null default now(),
  edited_at         timestamptz,
  deleted_at        timestamptz,
  constraint post_comments_body_state check (
    (deleted_at is not null and body is null)
    or (deleted_at is null and body is not null
        and char_length(btrim(body)) between 1 and 2000)
  )
);

create index if not exists post_comments_post_created_idx
  on public.post_comments (post_id, created_at desc);
create index if not exists post_comments_parent_idx
  on public.post_comments (parent_comment_id);
create index if not exists post_comments_author_idx
  on public.post_comments (author_id, created_at desc);

alter table public.post_comments enable row level security;

drop policy if exists post_comments_select on public.post_comments;
create policy post_comments_select on public.post_comments
  for select using (true);

drop policy if exists post_comments_insert_own on public.post_comments;
create policy post_comments_insert_own on public.post_comments
  for insert with check (author_id = auth.uid());

drop policy if exists post_comments_update_own on public.post_comments;
create policy post_comments_update_own on public.post_comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

-- the post author may remove (not edit) a comment on their own post
drop policy if exists post_comments_update_post_author on public.post_comments;
create policy post_comments_update_post_author on public.post_comments
  for update using (
    exists (select 1 from public.posts p
            where p.id = post_comments.post_id and p.author_id = auth.uid())
  ) with check (
    exists (select 1 from public.posts p
            where p.id = post_comments.post_id and p.author_id = auth.uid())
  );

-- depth cap + same-post reply
create or replace function public.enforce_comment_depth()
returns trigger language plpgsql security invoker set search_path to 'public' as $$
declare p public.post_comments;
begin
  if new.parent_comment_id is null then return new; end if;
  select * into p from public.post_comments where id = new.parent_comment_id;
  if not found then raise exception 'parent comment not found'; end if;
  if p.parent_comment_id is not null then
    raise exception 'replies are limited to one level';
  end if;
  if p.post_id <> new.post_id then
    raise exception 'reply must belong to the same post';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_comment_depth on public.post_comments;
create trigger trg_enforce_comment_depth
  before insert on public.post_comments
  for each row execute function public.enforce_comment_depth();

-- immutability, 15-minute edit window, author-vs-moderator split
create or replace function public.protect_post_comment_columns()
returns trigger language plpgsql security invoker set search_path to 'public' as $$
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

drop trigger if exists trg_protect_post_comment_columns on public.post_comments;
create trigger trg_protect_post_comment_columns
  before update on public.post_comments
  for each row execute function public.protect_post_comment_columns();

-- ---------------------------------------------------------------------------
-- 3. REPOSTS: plain + quote in one table; never a row in posts
-- ---------------------------------------------------------------------------
create table if not exists public.post_reposts (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  quote      text,
  quote_lang text check (quote_lang = any (array['en','ne'])),
  view       text not null check (view = any (array['us','nepal','bridge'])),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id),
  constraint post_reposts_quote_len check (
    quote is null or char_length(btrim(quote)) between 1 and 1000
  )
);

create index if not exists post_reposts_user_created_idx
  on public.post_reposts (user_id, created_at desc);
create index if not exists post_reposts_view_created_idx
  on public.post_reposts (view, created_at desc);

alter table public.post_reposts enable row level security;

drop policy if exists post_reposts_select on public.post_reposts;
create policy post_reposts_select on public.post_reposts
  for select using (true);

drop policy if exists post_reposts_insert_own on public.post_reposts;
create policy post_reposts_insert_own on public.post_reposts
  for insert with check (user_id = auth.uid());

drop policy if exists post_reposts_delete_own on public.post_reposts;
create policy post_reposts_delete_own on public.post_reposts
  for delete using (user_id = auth.uid());

-- no UPDATE policy: a quote is not editable. Un-repost and repost.

-- R6: a post may only be reposted into its own view or into bridge
create or replace function public.enforce_repost_view()
returns trigger language plpgsql security invoker set search_path to 'public' as $$
declare src_view text;
begin
  select p.view into src_view from public.posts p where p.id = new.post_id;
  if src_view is null then raise exception 'post not found'; end if;
  if new.view <> src_view and new.view <> 'bridge' then
    raise exception 'a % post may only be reposted into % or bridge', src_view, src_view;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_repost_view on public.post_reposts;
create trigger trg_enforce_repost_view
  before insert on public.post_reposts
  for each row execute function public.enforce_repost_view();

-- ---------------------------------------------------------------------------
-- 4. BOOKMARKS: private to the owner
-- ---------------------------------------------------------------------------
create table if not exists public.post_bookmarks (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_bookmarks_user_created_idx
  on public.post_bookmarks (user_id, created_at desc);

alter table public.post_bookmarks enable row level security;

drop policy if exists post_bookmarks_select_own on public.post_bookmarks;
create policy post_bookmarks_select_own on public.post_bookmarks
  for select using (user_id = auth.uid());

drop policy if exists post_bookmarks_insert_own on public.post_bookmarks;
create policy post_bookmarks_insert_own on public.post_bookmarks
  for insert with check (user_id = auth.uid());

drop policy if exists post_bookmarks_delete_own on public.post_bookmarks;
create policy post_bookmarks_delete_own on public.post_bookmarks
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. SHARES: append-only, author-visible counter (feeds Boost analytics, Task 3.2)
-- ---------------------------------------------------------------------------
create table if not exists public.post_shares (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  channel    text not null check (channel = any (array['dm','copy_link','native'])),
  created_at timestamptz not null default now()
);

create index if not exists post_shares_post_created_idx
  on public.post_shares (post_id, created_at desc);

alter table public.post_shares enable row level security;

-- own rows, or rows on a post you authored. Never world-readable:
-- "who shared this to a DM" is closer to private than to public.
drop policy if exists post_shares_select_scoped on public.post_shares;
create policy post_shares_select_scoped on public.post_shares
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.posts p
               where p.id = post_shares.post_id and p.author_id = auth.uid())
  );

drop policy if exists post_shares_insert_own on public.post_shares;
create policy post_shares_insert_own on public.post_shares
  for insert with check (user_id = auth.uid());

-- no UPDATE, no DELETE policy: append-only by design.

-- ---------------------------------------------------------------------------
-- 6. MEDIA on posts
-- ---------------------------------------------------------------------------
alter table public.posts
  add column if not exists media jsonb not null default '[]'::jsonb;

alter table public.posts drop constraint if exists posts_media_shape_check;
alter table public.posts add constraint posts_media_shape_check
  check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 4);

-- Element shape (validated by trigger below):
--   image: {"path","type":"image","mime","bytes","w","h"}
--   video: {"path","type":"video","mime","bytes","duration_ms","poster_path","w","h"}
-- 'live' is deliberately NOT accepted. When live streaming is green-lit this
-- function gains one branch; no table change is required.
create or replace function public.validate_post_media()
returns trigger language plpgsql security invoker set search_path to 'public' as $$
declare
  item jsonb;
  t    text;
  imgs int := 0;
  vids int := 0;
begin
  if new.media is null then new.media := '[]'::jsonb; end if;
  if jsonb_typeof(new.media) <> 'array' then
    raise exception 'media must be a json array';
  end if;
  if jsonb_array_length(new.media) > 4 then
    raise exception 'at most 4 media items per post';
  end if;

  for item in select value from jsonb_array_elements(new.media) loop
    if jsonb_typeof(item) <> 'object' then
      raise exception 'media item must be an object';
    end if;

    t := item->>'type';
    if t is null or t not in ('image','video') then
      raise exception 'media type must be image or video (got %)', coalesce(t,'null');
    end if;

    if coalesce(item->>'path','') = '' then
      raise exception 'media item requires path';
    end if;
    if item->>'path' like '%..%' then
      raise exception 'invalid media path';
    end if;
    if coalesce(item->>'mime','') = '' then
      raise exception 'media item requires mime';
    end if;
    if coalesce((item->>'bytes')::bigint, 0) <= 0 then
      raise exception 'media item requires bytes';
    end if;

    if t = 'image' then
      if item->>'mime' not in ('image/jpeg','image/png','image/webp','image/gif') then
        raise exception 'unsupported image mime %', item->>'mime';
      end if;
      if (item->>'bytes')::bigint > 10485760 then
        raise exception 'image exceeds 10MB';
      end if;
      imgs := imgs + 1;
    else
      if item->>'mime' not in ('video/mp4','video/webm','video/quicktime') then
        raise exception 'unsupported video mime %', item->>'mime';
      end if;
      if (item->>'bytes')::bigint > 52428800 then
        raise exception 'video exceeds 50MB';
      end if;
      if coalesce((item->>'duration_ms')::int, 0) <= 0
         or (item->>'duration_ms')::int > 90000 then
        raise exception 'video duration must be between 0 and 90 seconds';
      end if;
      if coalesce(item->>'poster_path','') = '' then
        raise exception 'video requires poster_path';
      end if;
      vids := vids + 1;
    end if;
  end loop;

  if vids > 1 then
    raise exception 'at most one video per post';
  end if;
  if vids > 0 and imgs > 0 then
    raise exception 'a post may contain up to 4 images or one video, not both';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_post_media on public.posts;
create trigger trg_validate_post_media
  before insert or update of media on public.posts
  for each row execute function public.validate_post_media();

-- ---------------------------------------------------------------------------
-- 7. STORAGE: post-media bucket (private; reads via signed URLs)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-media', 'post-media', false, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif',
        'video/mp4','video/webm','video/quicktime']
)
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists post_media_read on storage.objects;
create policy post_media_read on storage.objects
  for select to authenticated
  using (bucket_id = 'post-media');

drop policy if exists post_media_insert_own on storage.objects;
create policy post_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists post_media_delete_own on storage.objects;
create policy post_media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 8. REALTIME (public tables only — bookmarks and shares stay off the wire)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='post_comments'
  ) then
    alter publication supabase_realtime add table public.post_comments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='post_reactions'
  ) then
    alter publication supabase_realtime add table public.post_reactions;
  end if;
end $$;
