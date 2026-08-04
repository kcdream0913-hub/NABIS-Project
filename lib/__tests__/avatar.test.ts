import { describe, it, expect } from "vitest";
import { sniffMagic } from "../attachmentSniff";
import {
  avatarExtFor,
  isAllowedAvatarMime,
  avatarSniffAccepted,
  avatarObjectPath,
  avatarPathFromPublicUrl,
  AVATAR_BUCKET,
} from "../avatar";

const bytes = (...b: number[]) => new Uint8Array(b);

// Real leading signatures.
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);
const GIF = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
const PDF = bytes(0x25, 0x50, 0x44, 0x46);
const MZ = bytes(0x4d, 0x5a, 0x90, 0x00); // Windows executable

describe("avatarExtFor", () => {
  it("maps allowed mimes, else bin", () => {
    expect(avatarExtFor("image/jpeg")).toBe("jpg");
    expect(avatarExtFor("image/png")).toBe("png");
    expect(avatarExtFor("image/webp")).toBe("webp");
    expect(avatarExtFor("image/gif")).toBe("bin");
    expect(avatarExtFor("application/pdf")).toBe("bin");
  });
});

describe("isAllowedAvatarMime", () => {
  it("accepts exactly jpeg/png/webp", () => {
    expect(isAllowedAvatarMime("image/jpeg")).toBe(true);
    expect(isAllowedAvatarMime("image/png")).toBe(true);
    expect(isAllowedAvatarMime("image/webp")).toBe(true);
    expect(isAllowedAvatarMime("image/gif")).toBe(false);
    expect(isAllowedAvatarMime("application/pdf")).toBe(false);
    expect(isAllowedAvatarMime("application/octet-stream")).toBe(false);
  });
});

describe("avatarSniffAccepted — decision by MAGIC BYTES (never the claim)", () => {
  it("accepts a real jpeg/png/webp regardless of any claimed type", () => {
    expect(avatarSniffAccepted(sniffMagic(JPEG))).toBe(true);
    expect(avatarSniffAccepted(sniffMagic(PNG))).toBe(true);
    expect(avatarSniffAccepted(sniffMagic(WEBP))).toBe(true);
  });
  it("rejects a real GIF even though it sniffs as a valid image (not on the avatar allowlist)", () => {
    const s = sniffMagic(GIF);
    expect(s.ok && s.mime).toBe("image/gif"); // sniffs fine…
    expect(avatarSniffAccepted(s)).toBe(false); // …but is not an allowed avatar type
  });
  it("rejects a PDF and an executable renamed as an image (sniffed type wins)", () => {
    expect(avatarSniffAccepted(sniffMagic(PDF))).toBe(false); // sniffs pdf → not allowed
    const exe = sniffMagic(MZ);
    expect(exe.ok).toBe(false); // executable is rejected outright
    expect(avatarSniffAccepted(exe)).toBe(false);
  });
});

describe("avatarObjectPath — owner-carrying prefix", () => {
  it("builds user and business keys with the sniffed extension", () => {
    expect(avatarObjectPath("user", "U1", "abc", "image/webp")).toBe("user/U1/abc.webp");
    expect(avatarObjectPath("business", "B1", "def", "image/jpeg")).toBe("business/B1/def.jpg");
  });
});

describe("avatarPathFromPublicUrl — only ever targets OUR bucket", () => {
  const our = `https://proj.supabase.co/storage/v1/object/public/${AVATAR_BUCKET}/user/U1/a.webp`;
  it("extracts the object path from one of our public URLs", () => {
    expect(avatarPathFromPublicUrl(our)).toBe("user/U1/a.webp");
  });
  it("strips a query string", () => {
    expect(avatarPathFromPublicUrl(`${our}?token=xyz`)).toBe("user/U1/a.webp");
  });
  it("returns null for a foreign URL (OAuth avatar) so delete-on-replace never touches it", () => {
    expect(avatarPathFromPublicUrl("https://lh3.googleusercontent.com/a/xyz")).toBeNull();
  });
  it("returns null for null/empty", () => {
    expect(avatarPathFromPublicUrl(null)).toBeNull();
    expect(avatarPathFromPublicUrl("")).toBeNull();
  });
});
