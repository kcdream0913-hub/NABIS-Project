import { describe, it, expect } from "vitest";
import {
  reactionNotification,
  repostNotification,
  commentNotifications,
  unreadCount,
  badgeLabel,
  notificationHref,
  notificationLabelKey,
  type NotificationRow,
} from "../notifications";

// These mirror the SQL triggers in 20260728140000_notifications.sql. If either
// side changes, both must — these tests pin the shared contract.

describe("reactionNotification / repostNotification", () => {
  it("notifies the post author for a reaction by someone else", () => {
    expect(reactionNotification({ postAuthorId: "A", actorId: "B" })).toEqual({
      recipient_id: "A",
      type: "post_reaction",
    });
  });
  it("does NOT notify on a self-reaction (author reacts to own post)", () => {
    expect(reactionNotification({ postAuthorId: "A", actorId: "A" })).toBeNull();
  });
  it("does NOT notify when the post author is unknown", () => {
    expect(reactionNotification({ postAuthorId: null, actorId: "B" })).toBeNull();
  });
  it("repost mirrors reaction (other → notify, self → null)", () => {
    expect(repostNotification({ postAuthorId: "A", actorId: "B" })).toEqual({
      recipient_id: "A",
      type: "post_repost",
    });
    expect(repostNotification({ postAuthorId: "A", actorId: "A" })).toBeNull();
  });
});

describe("commentNotifications", () => {
  it("author comments on own post (top-level, self) → 0 rows", () => {
    expect(
      commentNotifications({ postAuthorId: "A", actorId: "A", parentAuthorId: null }),
    ).toEqual([]);
  });

  it("B comments top-level on A's post → 1 row (post_comment to A)", () => {
    expect(
      commentNotifications({ postAuthorId: "A", actorId: "B", parentAuthorId: null }),
    ).toEqual([{ recipient_id: "A", type: "post_comment" }]);
  });

  it("B replies to their OWN comment on A's post → exactly 1 row (post_comment to A), no self reply-notify", () => {
    const rows = commentNotifications({ postAuthorId: "A", actorId: "B", parentAuthorId: "B" });
    expect(rows).toEqual([{ recipient_id: "A", type: "post_comment" }]);
    expect(rows).toHaveLength(1);
  });

  it("B replies to A's comment where A is ALSO the post author → exactly 1 row (comment_reply to A), deduped (not also post_comment)", () => {
    const rows = commentNotifications({ postAuthorId: "A", actorId: "B", parentAuthorId: "A" });
    expect(rows).toEqual([{ recipient_id: "A", type: "comment_reply" }]);
    expect(rows).toHaveLength(1);
  });

  it("C replies to B's comment on A's post → 2 rows (comment_reply to B + post_comment to A)", () => {
    expect(
      commentNotifications({ postAuthorId: "A", actorId: "C", parentAuthorId: "B" }),
    ).toEqual([
      { recipient_id: "B", type: "comment_reply" },
      { recipient_id: "A", type: "post_comment" },
    ]);
  });

  it("A replies to their own top-level comment on someone else's deleted-author post → only the reply is suppressed", () => {
    // post author unknown, replying to own comment → no rows at all
    expect(
      commentNotifications({ postAuthorId: null, actorId: "A", parentAuthorId: "A" }),
    ).toEqual([]);
  });
});

describe("badge helpers", () => {
  const row = (read: boolean): Pick<NotificationRow, "read_at"> => ({
    read_at: read ? "2026-07-28T00:00:00Z" : null,
  });

  it("unreadCount counts only rows with a null read_at", () => {
    expect(unreadCount([row(false), row(true), row(false)])).toBe(2);
    expect(unreadCount([])).toBe(0);
    expect(unreadCount([row(true), row(true)])).toBe(0);
  });

  it("badgeLabel caps display at 9+ and hides at zero", () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(-1)).toBeNull();
    expect(badgeLabel(1)).toBe("1");
    expect(badgeLabel(9)).toBe("9");
    expect(badgeLabel(10)).toBe("9+");
    expect(badgeLabel(250)).toBe("9+");
  });

  it("mark-all-read drives unreadCount to 0", () => {
    const rows = [row(false), row(false), row(false)];
    expect(unreadCount(rows)).toBe(3);
    const allRead = rows.map((r) => ({ ...r, read_at: "2026-07-28T00:00:00Z" }));
    expect(unreadCount(allRead)).toBe(0);
    expect(badgeLabel(unreadCount(allRead))).toBeNull();
  });
});

describe("notificationHref / label key", () => {
  it("links to the post, comment-anchored when a comment is targeted", () => {
    expect(notificationHref({ post_id: "p1", comment_id: null })).toBe("/posts/p1");
    expect(notificationHref({ post_id: "p1", comment_id: "c9" })).toBe("/posts/p1#comment-c9");
    expect(notificationHref({ post_id: null, comment_id: null })).toBe("/");
  });
  it("maps type to an i18n label key", () => {
    expect(notificationLabelKey("post_reaction")).toBe("label.post_reaction");
    expect(notificationLabelKey("comment_reply")).toBe("label.comment_reply");
  });
});
