import { describe, it, expect, vi } from "vitest";
import {
  validateMediaSelection,
  generatePoster,
  guardMeta,
  mediaKind,
  mediaPath,
  extForMime,
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  type MediaCandidate,
  type VideoMeta,
} from "../media";

const img = (bytes: number, mime = "image/jpeg"): MediaCandidate => ({ mime, bytes });
const vid = (bytes: number, durationMs: number, mime = "video/mp4"): MediaCandidate => ({
  mime,
  bytes,
  durationMs,
});

// §5.3 — the picker validator matrix.
describe("validateMediaSelection", () => {
  it("rejects 5 images (too many)", () => {
    expect(validateMediaSelection(Array.from({ length: 5 }, () => img(1000)))).toEqual({
      ok: false,
      reason: "too-many-images",
    });
  });

  it("rejects 1 image + 1 video (no mixing)", () => {
    expect(validateMediaSelection([img(1000), vid(1000, 5000)])).toEqual({
      ok: false,
      reason: "no-mixing",
    });
  });

  it("rejects 2 videos (one video only)", () => {
    expect(validateMediaSelection([vid(1000, 5000), vid(1000, 5000)])).toEqual({
      ok: false,
      reason: "one-video-only",
    });
  });

  it("rejects a 91s video (too long)", () => {
    expect(validateMediaSelection([vid(1000, 91_000)])).toEqual({
      ok: false,
      reason: "video-too-long",
    });
  });

  it("rejects a 10.1MB image (too large)", () => {
    expect(validateMediaSelection([img(IMAGE_MAX_BYTES + 1)])).toEqual({
      ok: false,
      reason: "image-too-large",
    });
  });

  it("rejects a 51MB video (too large)", () => {
    expect(validateMediaSelection([vid(VIDEO_MAX_BYTES + 1, 5000)])).toEqual({
      ok: false,
      reason: "video-too-large",
    });
  });

  it("rejects an unsupported mime", () => {
    expect(validateMediaSelection([{ mime: "image/tiff", bytes: 10 }])).toEqual({
      ok: false,
      reason: "type",
    });
  });

  it("accepts 4 images", () => {
    expect(validateMediaSelection(Array.from({ length: 4 }, () => img(1000)))).toEqual({
      ok: true,
    });
  });

  it("accepts exactly 1 valid video", () => {
    expect(validateMediaSelection([vid(1000, 30_000)])).toEqual({ ok: true });
  });

  it("accepts a valid short (3s) video — regression for the Infinity-duration bug", () => {
    expect(validateMediaSelection([vid(1000, 3_000)])).toEqual({ ok: true });
  });

  // A non-finite / missing / zero duration is "unreadable", NOT "too long" — the
  // exact misclassification that blocked valid short videos when v.duration came
  // back as Infinity.
  it("reports Infinity duration as unreadable, not too-long", () => {
    expect(validateMediaSelection([vid(1000, Infinity)])).toEqual({
      ok: false,
      reason: "video-unreadable",
    });
  });

  it("reports NaN duration as unreadable", () => {
    expect(validateMediaSelection([vid(1000, Number.NaN)])).toEqual({
      ok: false,
      reason: "video-unreadable",
    });
  });

  it("reports a missing duration as unreadable", () => {
    expect(validateMediaSelection([{ mime: "video/mp4", bytes: 1000 }])).toEqual({
      ok: false,
      reason: "video-unreadable",
    });
  });

  it("reports a zero duration as unreadable", () => {
    expect(validateMediaSelection([vid(1000, 0)])).toEqual({
      ok: false,
      reason: "video-unreadable",
    });
  });
});

describe("mediaKind / path / ext", () => {
  it("classifies mimes", () => {
    expect(mediaKind("image/png")).toBe("image");
    expect(mediaKind("video/webm")).toBe("video");
    expect(mediaKind("application/pdf")).toBeNull();
  });
  it("builds a uid-prefixed path (storage RLS)", () => {
    expect(mediaPath("user-1", "abc", "jpg")).toBe("user-1/abc.jpg");
  });
  it("maps mime to extension", () => {
    expect(extForMime("video/quicktime")).toBe("mov");
    expect(extForMime("image/webp")).toBe("webp");
  });
});

// §5.4 — poster returns a blob for a valid video and fails closed (no upload) when
// metadata never loads.
describe("generatePoster", () => {
  it("returns a blob when metadata loads", async () => {
    const meta: VideoMeta = { durationMs: 30_000, width: 1280, height: 720 };
    const blob = new Blob(["x"], { type: "image/webp" });
    const capture = vi.fn(async () => blob);
    const out = await generatePoster(new Blob(["v"]), {
      loadMeta: async () => meta,
      capture,
    });
    expect(out).toBe(blob);
    expect(capture).toHaveBeenCalledOnce();
  });

  it("fails closed (null, no capture) when metadata never loads", async () => {
    const capture = vi.fn(async () => new Blob(["x"]));
    const out = await generatePoster(new Blob(["v"]), {
      loadMeta: async () => null, // never loaded
      capture,
    });
    expect(out).toBeNull();
    expect(capture).not.toHaveBeenCalled();
  });
});

// guardMeta is what makes "never loads" resolve to null instead of hanging.
describe("guardMeta", () => {
  it("resolves the value when the promise settles", async () => {
    const now: Array<() => void> = [];
    const out = await guardMeta(Promise.resolve(42), 1000, (fn) => now.push(fn));
    expect(out).toBe(42);
  });

  it("resolves null when the timeout fires first (never loads)", async () => {
    // never-settling promise; fire the scheduled timeout immediately
    const out = await guardMeta<number>(new Promise<number>(() => {}), 10, (fn) => fn());
    expect(out).toBeNull();
  });
});
