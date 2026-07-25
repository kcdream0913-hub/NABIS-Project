import { describe, it, expect } from "vitest";
import { isUnread } from "../messaging";

const ME = "me";

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
