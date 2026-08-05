-- Rollback for 20260728140000_notifications.sql (BL-NOTIF-01).
-- Drop dependents before the table; remove from the realtime publication while
-- the table still exists (ALTER PUBLICATION ... DROP TABLE has no IF EXISTS).

-- realtime first (table must still exist)
alter publication supabase_realtime drop table public.notifications;

-- source triggers + their functions
drop trigger if exists trg_notify_post_repost on public.post_reposts;
drop function if exists public.notify_post_repost();

drop trigger if exists trg_notify_post_comment on public.post_comments;
drop function if exists public.notify_post_comment();

drop trigger if exists trg_notify_post_reaction on public.post_reactions;
drop function if exists public.notify_post_reaction();

-- column guard
drop trigger if exists trg_protect_notification_columns on public.notifications;
drop function if exists public.protect_notification_columns();

-- policies (also dropped implicitly with the table; explicit for clarity)
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_select_own on public.notifications;

-- table (drops its indexes with it)
drop table if exists public.notifications;

-- channel unread column
alter table public.channel_memberships drop column if exists last_read_at;
