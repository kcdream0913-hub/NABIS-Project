import { describe, it, expect } from "vitest";
import {
  canReplyTo,
  resolveParentId,
  canEditComment,
  canDeleteOwnComment,
  canModerateComment,
  isCommentBodyValid,
  COMMENT_EDIT_WINDOW_MS,
  type PostComment,
} from "../comments";

const base = (over: Partial<PostComment> = {}): PostComment => ({
  id: "c1",
  post_id: "p1",
  author_id: "u1",
  parent_comment_id: null,
  body: "hello",
  body_lang: "en",
  created_at: new Date(0).toISOString(),
  edited_at: null,
  deleted_at: null,
  ...over,
});

// §5.5 — reply-to-a-reply blocked client-side before the DB sees it.
describe("comment depth", () => {
  it("allows replying to a top-level comment", () => {
    expect(canReplyTo(base({ parent_comment_id: null }))).toBe(true);
  });

  it("blocks replying to a reply", () => {
    expect(canReplyTo(base({ id: "c2", parent_comment_id: "c1" }))).toBe(false);
  });

  it("blocks replying to a deleted comment", () => {
    expect(canReplyTo(base({ deleted_at: new Date().toISOString() }))).toBe(false);
  });

  it("re-parents a reply-under-a-reply to the top-level parent (stays one level)", () => {
    expect(resolveParentId({ id: "c2", parent_comment_id: "c1" })).toBe("c1");
    expect(resolveParentId({ id: "c1", parent_comment_id: null })).toBe("c1");
  });
});

describe("edit window", () => {
  const t0 = 1_000_000_000_000;
  const c = base({ author_id: "me", created_at: new Date(t0).toISOString() });

  it("own comment editable inside 15 minutes", () => {
    expect(canEditComment(c, "me", t0 + COMMENT_EDIT_WINDOW_MS - 1)).toBe(true);
  });

  it("own comment not editable after 15 minutes", () => {
    expect(canEditComment(c, "me", t0 + COMMENT_EDIT_WINDOW_MS + 1)).toBe(false);
  });

  it("someone else's comment is never editable by me", () => {
    expect(canEditComment(c, "other", t0)).toBe(false);
  });

  it("a deleted comment is not editable", () => {
    expect(canEditComment(base({ author_id: "me", deleted_at: new Date().toISOString(), body: null }), "me", t0)).toBe(false);
  });
});

describe("delete / moderate", () => {
  it("author can delete own comment any time", () => {
    expect(canDeleteOwnComment(base({ author_id: "me" }), "me")).toBe(true);
  });
  it("post author can remove others' comments", () => {
    // comment by u1, moderated by the post author (also u-owner), viewer = owner
    expect(canModerateComment(base({ author_id: "u1" }), "owner", "owner")).toBe(true);
  });
  it("post author cannot 'moderate' their own comment (that's edit/delete)", () => {
    expect(canModerateComment(base({ author_id: "owner" }), "owner", "owner")).toBe(false);
  });
  it("a non-post-author cannot moderate", () => {
    expect(canModerateComment(base({ author_id: "u1" }), "owner", "stranger")).toBe(false);
  });
});

describe("body validity", () => {
  it("rejects empty / whitespace", () => {
    expect(isCommentBodyValid("   ")).toBe(false);
  });
  it("rejects > 2000 chars", () => {
    expect(isCommentBodyValid("a".repeat(2001))).toBe(false);
  });
  it("accepts normal text", () => {
    expect(isCommentBodyValid("nice post")).toBe(true);
  });
});
