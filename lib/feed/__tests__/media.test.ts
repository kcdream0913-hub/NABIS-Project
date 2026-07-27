import { describe, it, expect } from "vitest";
import {
  validateMediaSelection,
  mediaKind,
  mediaPath,
  extForMime,
  IMAGE_MAX_BYTES,
  type MediaCandidate,
} from "../media";

const img = (bytes: number, mime = "image/jpeg"): MediaCandidate => ({ mime, bytes });
const vid = (bytes = 1000, mime = "video/mp4"): MediaCandidate => ({ mime, bytes });

// §5.3 — the picker's STRUCTURAL validator (video duration is validated separately
// by checkVideoForComposer / lib/media; video size by the composer's size gate).
describe("validateMediaSelection", () => {
  it("rejects an empty selection", () => {
    expect(validateMediaSelection([])).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects 5 images (too many)", () => {
    expect(validateMediaSelection(Array.from({ length: 5 }, () => img(1000)))).toEqual({
      ok: false,
      reason: "too-many-images",
    });
  });

  it("rejects 1 image + 1 video (no mixing)", () => {
    expect(validateMediaSelection([img(1000), vid()])).toEqual({
      ok: false,
      reason: "no-mixing",
    });
  });

  it("rejects 2 videos (one video only)", () => {
    expect(validateMediaSelection([vid(), vid()])).toEqual({
      ok: false,
      reason: "one-video-only",
    });
  });

  it("rejects an unsupported mime", () => {
    expect(validateMediaSelection([{ mime: "image/tiff", bytes: 10 }])).toEqual({
      ok: false,
      reason: "type",
    });
  });

  it("rejects a 10.1MB image (too large)", () => {
    expect(validateMediaSelection([img(IMAGE_MAX_BYTES + 1)])).toEqual({
      ok: false,
      reason: "image-too-large",
    });
  });

  it("accepts 4 images", () => {
    expect(validateMediaSelection(Array.from({ length: 4 }, () => img(1000)))).toEqual({ ok: true });
  });

  it("accepts exactly 1 video (duration checked elsewhere)", () => {
    expect(validateMediaSelection([vid()])).toEqual({ ok: true });
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
