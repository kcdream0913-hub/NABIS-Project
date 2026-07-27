import { describe, it, expect } from "vitest";
import {
  generateIdentity,
  generateThreadKey,
  wrapThreadKey,
  unwrapThreadKey,
  encryptText,
  decryptText,
  encryptBytes,
  decryptBytes,
  wrapPrivateKeyForRecovery,
  unwrapPrivateKeyFromRecovery,
  bytesToB64,
  b64ToBytes,
} from "../crypto";

describe("base64 round-trip", () => {
  it("encodes and decodes arbitrary bytes", () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255, 127, 128]);
    expect(Array.from(b64ToBytes(bytesToB64(bytes)))).toEqual(Array.from(bytes));
  });
});

describe("message encryption with a thread key", () => {
  it("round-trips text", async () => {
    const key = await generateThreadKey();
    const sealed = await encryptText(key, "नमस्ते — hello 🙏");
    expect(sealed.ct).not.toContain("hello");
    expect(await decryptText(key, sealed)).toBe("नमस्ते — hello 🙏");
  });

  it("uses a fresh IV each time (no nonce reuse)", async () => {
    const key = await generateThreadKey();
    const a = await encryptText(key, "same");
    const b = await encryptText(key, "same");
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it("a different thread key cannot decrypt", async () => {
    const k1 = await generateThreadKey();
    const k2 = await generateThreadKey();
    const sealed = await encryptText(k1, "secret");
    await expect(decryptText(k2, sealed)).rejects.toBeTruthy();
  });

  it("round-trips attachment bytes", async () => {
    const key = await generateThreadKey();
    const blob = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    const sealed = await encryptBytes(key, blob);
    expect(Array.from(await decryptBytes(key, sealed))).toEqual(Array.from(blob));
  });
});

describe("thread-key wrapping (ECDH + HKDF) between two identities", () => {
  it("recipient unwraps and can read the sender's message", async () => {
    const alice = await generateIdentity();
    const bob = await generateIdentity();
    const threadKey = await generateThreadKey();

    // Alice wraps the thread key for Bob using her private + Bob's public.
    const wrapped = await wrapThreadKey(threadKey, alice.privateKey, bob.publicKey);
    // Bob unwraps using his private + Alice's public (ECDH symmetry).
    const bobThreadKey = await unwrapThreadKey(wrapped, bob.privateKey, alice.publicKey);

    const sealed = await encryptText(threadKey, "corridor deal terms");
    expect(await decryptText(bobThreadKey, sealed)).toBe("corridor deal terms");
  });

  it("a WRONG participant cannot unwrap a thread key (negative)", async () => {
    const alice = await generateIdentity();
    const bob = await generateIdentity();
    const eve = await generateIdentity();
    const threadKey = await generateThreadKey();

    const wrappedForBob = await wrapThreadKey(threadKey, alice.privateKey, bob.publicKey);
    // Eve tries with her own private key against Alice's public — different shared
    // secret → AES-GCM authentication fails.
    await expect(unwrapThreadKey(wrappedForBob, eve.privateKey, alice.publicKey)).rejects.toBeTruthy();
  });
});

describe("recovery-phrase private-key backup (PBKDF2)", () => {
  const PHRASE = "abandon ability able about above absent absorb abstract absurd abuse access accident";

  it("wraps and unwraps the private key with the correct phrase", async () => {
    const alice = await generateIdentity();
    const blob = await wrapPrivateKeyForRecovery(alice.jwks.privateKey, PHRASE);
    const recovered = await unwrapPrivateKeyFromRecovery(blob, PHRASE);
    expect(recovered.d).toBe(alice.jwks.privateKey.d); // the private scalar matches
    expect(recovered.x).toBe(alice.jwks.privateKey.x);
  });

  it("the wrong phrase cannot recover the key (negative)", async () => {
    const alice = await generateIdentity();
    const blob = await wrapPrivateKeyForRecovery(alice.jwks.privateKey, PHRASE);
    await expect(
      unwrapPrivateKeyFromRecovery(blob, "wrong wrong wrong wrong wrong wrong wrong wrong wrong wrong wrong wrong"),
    ).rejects.toBeTruthy();
  });

  it("a recovered private key actually decrypts a thread key wrapped for it", async () => {
    // End-to-end: Alice loses storage, restores her private key from the phrase,
    // and can still unwrap a thread key a peer wrapped for her.
    const alice = await generateIdentity();
    const bob = await generateIdentity();
    const threadKey = await generateThreadKey();
    const wrappedForAlice = await wrapThreadKey(threadKey, bob.privateKey, alice.publicKey);

    const blob = await wrapPrivateKeyForRecovery(alice.jwks.privateKey, PHRASE);
    const recoveredJwk = await unwrapPrivateKeyFromRecovery(blob, PHRASE);
    const recoveredPriv = await globalThis.crypto.subtle.importKey(
      "jwk",
      recoveredJwk,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"],
    );

    const aliceThreadKey = await unwrapThreadKey(wrappedForAlice, recoveredPriv, bob.publicKey);
    const sealed = await encryptText(threadKey, "still readable after recovery");
    expect(await decryptText(aliceThreadKey, sealed)).toBe("still readable after recovery");
  });
});
