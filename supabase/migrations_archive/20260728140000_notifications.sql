-- BL-NOTIF-01 — in-app notifications v1 (Activity bell only).
--
-- DESIGN (decided upstream, do not re-litigate here):
--  * TWO badge sources, NOT unified. This table backs the ACTIVITY bell only
--    (reactions, comments, comment replies, reposts). The MESSAGES badge is
--    computed from existing unread state (direct_thread_participants.last_read_at
--    vs messages.created_at, + channel_memberships.last_read_at added below) and
--    NEVER writes a row here: DM bodies are encrypted-capable (messages.body_iv,
--    thread_keys, user_keys), so a trigger could not render a DM preview and a DM
--    notification row would just duplicate unread state we already track.
--  * Rows store REFERENCES ONLY — actor_id, post_id, comment_id, type, view. No
--    body/preview text is copied in; the UI renders the label from the type + a
--    join to profiles/posts. (Keeps this table cheap and avoids leaking post text
--    into a second place with its own RLS surface.)
--  * @mentions are OUT of v1 — no mentions table, no parsing convention exists.
--
-- SECURITY: the three notify_* functions and the column guard are SECURITY
-- DEFINER with `set search_path = ''` and fully schema-qualified references, per
-- the DEFINER hardening doc. There is NO INSERT policy for `authenticated` —
-- rows are created ONLY by these triggers (which run as definer and bypass RLS).
--
-- The trigger decision logic is MIRRORED, unit-tested, in lib/notifications.ts
-- (reactionNotification / commentNotifications / repostNotification). Keep the two
-- in sync: any change to who-gets-notified must land in both.

-- ── table ──────────────────────────────────────────────────────────────────
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  type         text not null check (type in
                 ('post_reaction','post_comment','comment_reply','post_repost')),
  post_id      uuid references public.posts(id) on delete cascade,
  comment_id   uuid references public.post_comments(id) on delete cascade,
  view         text,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

-- Listing (newest-first by recipient) + a partial index for the unread badge/list.
create index notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc) where read_at is null;

-- FK-covering indexes (NOT in the original draft — added to keep the performance
-- advisor's `unindexed_foreign_keys` clean; recipient_id is already covered as the
-- leading column of notifications_recipient_idx). These also make the ON DELETE
-- CASCADE / SET NULL from posts/comments/profiles a lookup instead of a seq scan.
create index notifications_actor_idx   on public.notifications (actor_id);
create index notifications_post_idx    on public.notifications (post_id);
create index notifications_comment_idx on public.notifications (comment_id);

-- One notification per (recipient, actor, post) for the toggleable actions.
-- post_reactions/post_reposts have DELETE policies (D-040), so unreact→re-react
-- is DELETE+INSERT and would otherwise re-fire the AFTER INSERT trigger on every
-- click (proved against prod: 3 like-clicks → 3 rows). Comments are deliberately
-- EXCLUDED — each distinct comment must notify. Product note: if BridgeLink ever
-- wants "B reacted to your post again", THIS index is the thing to revisit.
create unique index notifications_dedupe_idx
  on public.notifications (recipient_id, actor_id, type, post_id)
  where type in ('post_reaction','post_repost');

-- ── RLS: read own, mark own read. No INSERT policy (triggers only). ──────────
alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

-- The UPDATE policy above would otherwise let a recipient rewrite
-- type/actor/post/comment/view on their own rows. Pin every column except
-- read_at (the existing protect_* pattern).
create or replace function public.protect_notification_columns()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.recipient_id is distinct from old.recipient_id
     or new.actor_id   is distinct from old.actor_id
     or new.type       is distinct from old.type
     or new.post_id    is distinct from old.post_id
     or new.comment_id is distinct from old.comment_id
     or new.view       is distinct from old.view
     or new.created_at is distinct from old.created_at then
    raise exception 'only read_at may be updated';
  end if;
  return new;
end;
$$;
create trigger trg_protect_notification_columns
  before update on public.notifications
  for each row execute function public.protect_notification_columns();

-- ── reaction → notify the post author ───────────────────────────────────────
-- AFTER INSERT + `on conflict do nothing` (notifications_dedupe_idx): exactly one
-- reaction notification per (recipient, actor, post). A change-of-kind is an
-- upsert→UPDATE (never fires this); an unreact→re-react is DELETE+INSERT (would
-- re-fire it) — the dedupe index absorbs both. Self-reaction is skipped.
create or replace function public.notify_post_reaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid; v_view text;
begin
  select p.author_id, p.view into v_author, v_view
    from public.posts p where p.id = new.post_id;
  if v_author is null or v_author = new.user_id then return new; end if;
  insert into public.notifications
    (recipient_id, actor_id, type, post_id, view)
  values (v_author, new.user_id, 'post_reaction', new.post_id, v_view)
  on conflict do nothing;
  return new;
end;
$$;
create trigger trg_notify_post_reaction
  after insert on public.post_reactions
  for each row execute function public.notify_post_reaction();

-- ── comment (+ reply) ───────────────────────────────────────────────────────
-- A reply notifies the PARENT comment's author (comment_reply). The POST author
-- is notified (post_comment) unless they are the commenter OR already the parent
-- author (so they get one notification, never two). Self-actions are skipped.
create or replace function public.notify_post_comment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid; v_view text; v_parent_author uuid;
begin
  select p.author_id, p.view into v_author, v_view
    from public.posts p where p.id = new.post_id;

  if new.parent_comment_id is not null then
    select c.author_id into v_parent_author
      from public.post_comments c where c.id = new.parent_comment_id;
    if v_parent_author is not null and v_parent_author <> new.author_id then
      insert into public.notifications
        (recipient_id, actor_id, type, post_id, comment_id, view)
      values (v_parent_author, new.author_id, 'comment_reply',
              new.post_id, new.id, v_view);
    end if;
  end if;

  if v_author is not null
     and v_author <> new.author_id
     and (v_parent_author is null or v_parent_author <> v_author) then
    insert into public.notifications
      (recipient_id, actor_id, type, post_id, comment_id, view)
    values (v_author, new.author_id, 'post_comment',
            new.post_id, new.id, v_view);
  end if;
  return new;
end;
$$;
create trigger trg_notify_post_comment
  after insert on public.post_comments
  for each row execute function public.notify_post_comment();

-- ── repost → notify the post author ─────────────────────────────────────────
-- Reads the POST's view (v_view), NOT post_reposts.view (the reposter's chosen
-- target): enforce_repost_view lets a `us` post be reposted into `bridge`, so
-- those diverge and the bell should describe the post. Deduped like reactions.
create or replace function public.notify_post_repost()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid; v_view text;
begin
  select p.author_id, p.view into v_author, v_view from public.posts p where p.id = new.post_id;
  if v_author is null or v_author = new.user_id then return new; end if;
  insert into public.notifications
    (recipient_id, actor_id, type, post_id, view)
  values (v_author, new.user_id, 'post_repost', new.post_id, v_view)
  on conflict do nothing;
  return new;
end;
$$;
create trigger trg_notify_post_repost
  after insert on public.post_reposts
  for each row execute function public.notify_post_repost();

-- ── channel unread state (did not exist before) ─────────────────────────────
-- Mirrors direct_thread_participants.last_read_at so the MESSAGES badge can cover
-- channels the same way it covers DMs. Nullable = never opened yet.
alter table public.channel_memberships
  add column last_read_at timestamptz;

-- ── realtime: notifications is NOT in the publication by default ─────────────
alter publication supabase_realtime add table public.notifications;
