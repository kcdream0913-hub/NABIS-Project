import { describe, it, expect, vi } from "vitest";
import { logShareSafe, postPermalink, shareDmBody } from "../share";

// §5.7 — share logging failure does not reject the share promise.
describe("logShareSafe", () => {
  it("resolves even when the insert rejects", async () => {
    await expect(
      logShareSafe(() => Promise.reject(new Error("db down"))),
    ).resolves.toBeUndefined();
  });

  it("resolves when the insert returns a PostgREST { error } object", async () => {
    await expect(
      logShareSafe(async () => ({ error: { message: "rls" } })),
    ).resolves.toBeUndefined();
  });

  it("still calls the insert exactly once on success", async () => {
    const insert = vi.fn(async () => {});
    await logShareSafe(insert);
    expect(insert).toHaveBeenCalledOnce();
  });
});

describe("postPermalink", () => {
  it("builds an internal /posts/<id> link and trims a trailing slash", () => {
    expect(postPermalink("https://x.app/", "p1")).toBe("https://x.app/posts/p1");
    expect(postPermalink("https://x.app", "p1")).toBe("https://x.app/posts/p1");
  });
});

describe("shareDmBody", () => {
  it("includes the label and permalink, and quotes when present", () => {
    const body = shareDmBody("https://x.app/posts/p1", "great insight", "Shared a post");
    expect(body).toContain("Shared a post");
    expect(body).toContain("https://x.app/posts/p1");
    expect(body).toContain("great insight");
  });
  it("omits the quote block when there is no quote", () => {
    const body = shareDmBody("https://x.app/posts/p1", null, "Shared a post");
    expect(body).toBe("Shared a post\nhttps://x.app/posts/p1");
  });
});
