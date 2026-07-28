// BL-NOTIF-01 — notification logic, in ONE place.
//
// The who-gets-notified rules here MIRROR the SQL triggers in
// supabase/migrations/20260728140000_notifications.sql
// (notify_post_reaction / notify_post_comment / notify_post_repost). They are
// duplicated deliberately: the DB is the source of truth at runtime, and these
// pure functions let us unit-test the exact same decisions without a database.
// Any change to who-gets-notified MUST land in both files.
//
// DEDUPE IS A DB CONCERN, NOT DECISION LOGIC. reactions/reposts are toggleable
// (unreact→re-react = DELETE+INSERT), so at-most-one notification per
// (recipient, actor, post) is enforced by the partial unique index
// `notifications_dedupe_idx` + `on conflict do nothing` in the triggers — NOT
// here. Do not add a "have I already notified?" branch to these functions; they
// answer "should this action notify, and whom", once per action. Comments are
// intentionally NOT deduped — each distinct comment notifies.

export type NotificationType =
  | "post_reaction"
  | "post_comment"
  | "comment_reply"
  | "post_repost";

export interface NotificationRow {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  view: string | null;
  created_at: string;
  read_at: string | null;
}

export interface PendingNotification {
  recipient_id: string;
  type: NotificationType;
}

// A reaction notifies the post author — never yourself.
export function reactionNotification(input: {
  postAuthorId: string | null;
  actorId: string;
}): PendingNotification | null {
  const { postAuthorId, actorId } = input;
  if (!postAuthorId || postAuthorId === actorId) return null;
  return { recipient_id: postAuthorId, type: "post_reaction" };
}

// A repost notifies the post author — never yourself.
export function repostNotification(input: {
  postAuthorId: string | null;
  actorId: string;
}): PendingNotification | null {
  const { postAuthorId, actorId } = input;
  if (!postAuthorId || postAuthorId === actorId) return null;
  return { recipient_id: postAuthorId, type: "post_repost" };
}

// A comment notifies:
//  - the PARENT comment's author (comment_reply), when replying and not to self;
//  - the POST author (post_comment), unless they are the commenter OR already the
//    parent author (so the post author gets exactly one notification, never two).
export function commentNotifications(input: {
  postAuthorId: string | null;
  actorId: string;
  parentAuthorId: string | null; // null for a top-level comment
}): PendingNotification[] {
  const { postAuthorId, actorId, parentAuthorId } = input;
  const out: PendingNotification[] = [];
  if (parentAuthorId && parentAuthorId !== actorId) {
    out.push({ recipient_id: parentAuthorId, type: "comment_reply" });
  }
  if (
    postAuthorId &&
    postAuthorId !== actorId &&
    (parentAuthorId === null || parentAuthorId !== postAuthorId)
  ) {
    out.push({ recipient_id: postAuthorId, type: "post_comment" });
  }
  return out;
}

// ── badge helpers ────────────────────────────────────────────────────────────

export function unreadCount(rows: Pick<NotificationRow, "read_at">[]): number {
  return rows.reduce((n, r) => n + (r.read_at ? 0 : 1), 0);
}

// Badge text with a 9+ display cap (LinkedIn/Slack style). null = no badge.
export function badgeLabel(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? "9+" : String(count);
}

// Where a notification row navigates. Comment-anchored when it targets a comment,
// so clicking a reply scrolls to that comment.
export function notificationHref(
  n: Pick<NotificationRow, "post_id" | "comment_id">,
): string {
  if (!n.post_id) return "/";
  return n.comment_id ? `/posts/${n.post_id}#comment-${n.comment_id}` : `/posts/${n.post_id}`;
}

// i18n key (under the `notifications` namespace) for a row's action label.
export function notificationLabelKey(type: NotificationType): string {
  return `label.${type}`;
}
