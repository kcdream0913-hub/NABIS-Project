// BL-SOCIAL-02 §4.2 — comment thread rules. The 15-minute edit window and the
// author-vs-moderator split are the SAME shape as the messenger (lib/messaging.ts)
// and are ultimately enforced by protect_post_comment_columns() in the DB — these
// client helpers only gate the affordance so a clock-skewed client can't bypass.

export type PostComment = {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body: string | null;
  body_lang: "en" | "ne" | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export const COMMENT_MAX = 2000;
export const COMMENT_COUNTER_AT = 1800; // show the counter from here up
export const COMMENT_EDIT_WINDOW_MS = 15 * 60 * 1000; // mirror the messenger

const within = (createdAt: string, windowMs: number, nowMs: number) =>
  nowMs - Date.parse(createdAt) <= windowMs;

export function isDeleted(c: Pick<PostComment, "deleted_at">): boolean {
  return c.deleted_at !== null;
}

// §4.2 depth cap: exactly one level of replies. A reply may only target a
// TOP-LEVEL comment — replying to a reply is blocked client-side before the DB
// (enforce_comment_depth) ever sees it.
export function canReplyTo(
  target: Pick<PostComment, "parent_comment_id" | "deleted_at">,
): boolean {
  if (target.deleted_at) return false;
  return target.parent_comment_id === null;
}

// The composed parent_comment_id for a new reply: replying under a reply re-parents
// to that reply's own top-level parent, keeping the tree one level deep. Returns
// null when the target can't be replied to (caller should block).
export function resolveParentId(
  target: Pick<PostComment, "id" | "parent_comment_id">,
): string {
  return target.parent_comment_id ?? target.id;
}

// Own, not-deleted comment inside the 15-minute edit window.
export function canEditComment(
  c: PostComment,
  myId: string,
  nowMs: number,
): boolean {
  if (c.author_id !== myId) return false;
  if (c.deleted_at) return false;
  if (!c.body) return false;
  return within(c.created_at, COMMENT_EDIT_WINDOW_MS, nowMs);
}

// The comment author may delete their own comment at any time (soft delete).
export function canDeleteOwnComment(c: PostComment, myId: string): boolean {
  return c.author_id === myId && !c.deleted_at;
}

// The POST author may remove (not edit) OTHERS' comments on their post. The DB
// trigger enforces remove-only; this just shows the affordance.
export function canModerateComment(
  c: PostComment,
  postAuthorId: string,
  myId: string,
): boolean {
  return (
    myId === postAuthorId && c.author_id !== myId && !c.deleted_at
  );
}

// Body validity for the composer (the DB CHECK is 1..2000 after btrim).
export function isCommentBodyValid(body: string): boolean {
  const n = body.trim().length;
  return n >= 1 && n <= COMMENT_MAX;
}
