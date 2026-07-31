import { describe, it, expect } from "vitest";
import {
  isUnread,
  shouldAdvanceRead,
  canEditMessage,
  canDeleteForEveryone,
  canDeleteForMe,
  isSeenByOthers,
  messagePreview,
  truncateQuote,
  buildThreadList,
  EDIT_WINDOW_MS,
  DELETE_EVERYONE_WINDOW_MS,
  type ChatMessage,
} from "../messaging";

const ME = "me";

const NOW = Date.parse("2026-07-26T12:00:00Z");
function msg(over: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "m1",
    thread_id: "t1",
    sender_id: ME,
    body: "hello",
    created_at: new Date(NOW).toISOString(),
    edited_at: null,
    deleted_at: null,
    reply_to_message_id: null,
    attachments: [],
    ...over,
  };
}
const agoMs = (ms: number) => new Date(NOW - ms).toISOString();

describe("isUnread", () => {
  it("is false when there is no last message", () => {
    expect(isUnread(null, null, ME)).toBe(false);
    expect(isUnread(undefined, "2026-01-01T00:00:00Z", ME)).toBe(false);
  });

  it("is false when the last message is my own", () => {
    expect(isUnread({ sender_id: ME, created_at: "2026-01-02T00:00:00Z" }, null, ME)).toBe(false);
  });

  it("is true when the other party's message is newer than last_read_at", () => {
    expect(
      isUnread({ sender_id: "other", created_at: "2026-01-02T00:00:00Z" }, "2026-01-01T00:00:00Z", ME),
    ).toBe(true);
  });

  it("is true when the thread was never read", () => {
    expect(isUnread({ sender_id: "other", created_at: "2026-01-02T00:00:00Z" }, null, ME)).toBe(true);
  });

  it("is false when I've already read past the last message", () => {
    expect(
      isUnread({ sender_id: "other", created_at: "2026-01-01T00:00:00Z" }, "2026-01-02T00:00:00Z", ME),
    ).toBe(false);
  });
});

describe("shouldAdvanceRead (continuous read-receipt gate)", () => {
  const OTHER = { sender_id: "other", created_at: "2026-07-26T12:00:00Z" };
  const base = {
    documentVisible: true,
    nearBottom: true,
    lastMessage: OTHER,
    userId: ME,
    lastWrittenIso: null as string | null,
    nowIso: "2026-07-26T12:00:05Z",
  };

  it("advances when visible, at bottom, on a fresh foreign message", () => {
    expect(shouldAdvanceRead(base)).toBe(true);
  });
  it("never advances while the tab is hidden (unseen must stay unseen)", () => {
    expect(shouldAdvanceRead({ ...base, documentVisible: false })).toBe(false);
  });
  it("never advances when scrolled up-thread (not near bottom)", () => {
    expect(shouldAdvanceRead({ ...base, nearBottom: false })).toBe(false);
  });
  it("does not advance for my own last message (no self-read)", () => {
    expect(shouldAdvanceRead({ ...base, lastMessage: { sender_id: ME, created_at: OTHER.created_at } })).toBe(false);
  });
  it("does not advance with no message or no user", () => {
    expect(shouldAdvanceRead({ ...base, lastMessage: null })).toBe(false);
    expect(shouldAdvanceRead({ ...base, userId: null })).toBe(false);
  });
  it("never writes backwards — now() must exceed the last written value", () => {
    expect(shouldAdvanceRead({ ...base, lastWrittenIso: "2026-07-26T12:00:05Z", nowIso: "2026-07-26T12:00:05Z" })).toBe(false);
    expect(shouldAdvanceRead({ ...base, lastWrittenIso: "2026-07-26T12:00:10Z", nowIso: "2026-07-26T12:00:05Z" })).toBe(false);
    expect(shouldAdvanceRead({ ...base, lastWrittenIso: "2026-07-26T12:00:00Z", nowIso: "2026-07-26T12:00:05Z" })).toBe(true);
  });
});

describe("canEditMessage (15-min window, own text messages)", () => {
  it("allows the owner to edit a fresh text message", () => {
    expect(canEditMessage(msg({ created_at: agoMs(60_000) }), ME, NOW)).toBe(true);
  });
  it("blocks editing after the window elapses", () => {
    expect(canEditMessage(msg({ created_at: agoMs(EDIT_WINDOW_MS + 1000) }), ME, NOW)).toBe(false);
  });
  it("blocks a non-owner", () => {
    expect(canEditMessage(msg({ sender_id: "other" }), ME, NOW)).toBe(false);
  });
  it("blocks editing a tombstone", () => {
    expect(canEditMessage(msg({ deleted_at: agoMs(0) }), ME, NOW)).toBe(false);
  });
  it("blocks editing a pure-attachment message (no text)", () => {
    expect(canEditMessage(msg({ body: null, attachments: [{ path: "p", type: "image/png", name: "a", size: 1 }] }), ME, NOW)).toBe(false);
  });
});

describe("canDeleteForEveryone (1-hr window, own)", () => {
  it("allows the owner within an hour", () => {
    expect(canDeleteForEveryone(msg({ created_at: agoMs(30 * 60_000) }), ME, NOW)).toBe(true);
  });
  it("blocks after an hour", () => {
    expect(canDeleteForEveryone(msg({ created_at: agoMs(DELETE_EVERYONE_WINDOW_MS + 1000) }), ME, NOW)).toBe(false);
  });
  it("blocks a non-owner", () => {
    expect(canDeleteForEveryone(msg({ sender_id: "other" }), ME, NOW)).toBe(false);
  });
});

describe("canDeleteForMe", () => {
  it("is allowed for any non-tombstone message (own or not, any age)", () => {
    expect(canDeleteForMe(msg({ sender_id: "other", created_at: agoMs(DELETE_EVERYONE_WINDOW_MS * 10) }))).toBe(true);
  });
  it("is not offered for a tombstone", () => {
    expect(canDeleteForMe(msg({ deleted_at: agoMs(0) }))).toBe(false);
  });
});

describe("isSeenByOthers (ticks on own messages)", () => {
  const created = new Date(NOW).toISOString();
  it("is seen when the other participant read at/after the message time", () => {
    expect(isSeenByOthers(msg({ created_at: created }), ME, [new Date(NOW + 1000).toISOString()])).toBe(true);
  });
  it("is not seen when the other's read cursor is older", () => {
    expect(isSeenByOthers(msg({ created_at: created }), ME, [new Date(NOW - 1000).toISOString()])).toBe(false);
  });
  it("is not seen when a participant never read", () => {
    expect(isSeenByOthers(msg({ created_at: created }), ME, [null])).toBe(false);
  });
  it("needs EVERY other participant caught up (group-ready)", () => {
    expect(isSeenByOthers(msg({ created_at: created }), ME, [new Date(NOW + 1000).toISOString(), null])).toBe(false);
  });
  it("never shows ticks on someone else's message", () => {
    expect(isSeenByOthers(msg({ sender_id: "other" }), ME, [new Date(NOW + 1000).toISOString()])).toBe(false);
  });
});

describe("messagePreview", () => {
  const L = { deleted: "This message was deleted", photo: "📷 Photo", document: "📄 Document" };
  it("prefers the tombstone label", () => {
    expect(messagePreview(msg({ deleted_at: agoMs(0) }), L)).toBe(L.deleted);
  });
  it("shows a photo glyph for image attachments", () => {
    expect(messagePreview(msg({ body: null, attachments: [{ path: "p", type: "image/jpeg", name: "a", size: 1 }] }), L)).toBe(L.photo);
  });
  it("shows a document glyph for non-image attachments", () => {
    expect(messagePreview(msg({ body: null, attachments: [{ path: "p", type: "application/pdf", name: "a", size: 1 }] }), L)).toBe(L.document);
  });
  it("falls back to the body text", () => {
    expect(messagePreview(msg({ body: "hi there" }), L)).toBe("hi there");
  });
});

describe("truncateQuote (~90 chars)", () => {
  it("passes short text through, collapsing whitespace", () => {
    expect(truncateQuote("hello   world")).toBe("hello world");
  });
  it("truncates with an ellipsis past the limit", () => {
    const out = truncateQuote("x".repeat(200), 90);
    expect(out.length).toBe(90);
    expect(out.endsWith("…")).toBe(true);
  });
});

// D-076. buildThreadList is the extracted, single implementation of "what does
// my inbox look like" — shared by the /messages page AND the new Feed rail so
// the two can't disagree. These tests are the ones that used to live only as
// untested inline logic in /messages/page.tsx.
describe("buildThreadList", () => {
  const L = { member: "Member", deleted: "This message was deleted", photo: "📷 Photo", document: "📄 Document" };

  it("joins each thread's other participant, latest message preview, and unread state", () => {
    const list = buildThreadList(
      [{ thread_id: "t1", last_read_at: null }],
      [{ thread_id: "t1", profiles: { name: "Jane Doe" } }],
      [{ thread_id: "t1", body: "hi", sender_id: "them", created_at: "2026-07-31T00:00:00Z", deleted_at: null, attachments: null }],
      "me",
      L,
    );
    expect(list).toEqual([
      { id: "t1", otherName: "Jane Doe", lastPreview: "hi", lastAt: "2026-07-31T00:00:00Z", unread: true },
    ]);
  });

  it("sorts newest-first by last message time", () => {
    const list = buildThreadList(
      [
        { thread_id: "old", last_read_at: null },
        { thread_id: "new", last_read_at: null },
      ],
      [
        { thread_id: "old", profiles: { name: "Old Thread" } },
        { thread_id: "new", profiles: { name: "New Thread" } },
      ],
      [
        { thread_id: "old", body: "a", sender_id: "them", created_at: "2026-07-01T00:00:00Z", deleted_at: null, attachments: null },
        { thread_id: "new", body: "b", sender_id: "them", created_at: "2026-07-30T00:00:00Z", deleted_at: null, attachments: null },
      ],
      "me",
      L,
    );
    expect(list.map((t) => t.id)).toEqual(["new", "old"]);
  });

  it("falls back to the member label when the other participant has no name", () => {
    const list = buildThreadList(
      [{ thread_id: "t1", last_read_at: null }],
      [{ thread_id: "t1", profiles: { name: null } }],
      [],
      "me",
      L,
    );
    expect(list[0].otherName).toBe("Member");
    expect(list[0].lastPreview).toBeNull();
    expect(list[0].lastAt).toBeNull();
  });

  it("is not unread when the last message is my own", () => {
    const list = buildThreadList(
      [{ thread_id: "t1", last_read_at: null }],
      [{ thread_id: "t1", profiles: { name: "Jane Doe" } }],
      [{ thread_id: "t1", body: "hi", sender_id: "me", created_at: "2026-07-31T00:00:00Z", deleted_at: null, attachments: null }],
      "me",
      L,
    );
    expect(list[0].unread).toBe(false);
  });

  it("uses the tombstone/attachment preview labels via messagePreview, not raw body", () => {
    const list = buildThreadList(
      [{ thread_id: "t1", last_read_at: null }],
      [{ thread_id: "t1", profiles: { name: "Jane Doe" } }],
      [{ thread_id: "t1", body: "should not show", sender_id: "them", created_at: "2026-07-31T00:00:00Z", deleted_at: "2026-07-31T00:00:01Z", attachments: null }],
      "me",
      L,
    );
    expect(list[0].lastPreview).toBe(L.deleted);
  });

  it("takes the FIRST profiles entry when Supabase returns an array embed instead of an object", () => {
    const list = buildThreadList(
      [{ thread_id: "t1", last_read_at: null }],
      [{ thread_id: "t1", profiles: [{ name: "Array Shape" }] }],
      [],
      "me",
      L,
    );
    expect(list[0].otherName).toBe("Array Shape");
  });
});
