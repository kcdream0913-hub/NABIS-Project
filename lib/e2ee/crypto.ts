// End-to-end encryption primitives — Web Crypto API only, standard constructions.
// NO hand-rolled primitives. This module is environment-agnostic (works in the
// browser and in Node ≥20 / jsdom for tests); IndexedDB and BIP39 live elsewhere.
//
// Scheme (see docs / migration 20260726160000_messaging_e2ee):
//  · identity keypair: ECDH P-256
//  · thread key: AES-GCM-256, wrapped per participant with a KEK =
//    HKDF-SHA256(ECDH(myPriv, theirPub))
//  · message body: AES-GCM with a fresh 12-byte IV
//  · recovery: AES-GCM wrap of the private key under a KEK =
//    PBKDF2-SHA256(recovery phrase)

const subtle = () => globalThis.crypto.subtle;
const te = new TextEncoder();
// TS 5.7 types Uint8Array as Uint8Array<ArrayBufferLike>, but WebCrypto's
// BufferSource requires ArrayBuffer-backed views — copy encoded text into one.
const enc = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(te.encode(s));

const KEK_INFO = enc("bridgelink-thread-kek-v1");
export const RECOVERY_ITERATIONS = 250_000;

// ── base64 <-> bytes (browser + Node) ──
export function bytesToB64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}
export function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function randomIv(): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(12));
}

export type Sealed = { iv: string; ct: string }; // both base64

// ── identity keypair (ECDH P-256) ──
export type IdentityJwks = { publicKey: JsonWebKey; privateKey: JsonWebKey };

export async function generateIdentity(): Promise<{ jwks: IdentityJwks; publicKey: CryptoKey; privateKey: CryptoKey }> {
  const pair = await subtle().generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const [publicKey, privateKey] = [pair.publicKey, pair.privateKey];
  const jwks = {
    publicKey: await subtle().exportKey("jwk", publicKey),
    privateKey: await subtle().exportKey("jwk", privateKey),
  };
  return { jwks, publicKey, privateKey };
}

export function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return subtle().importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
}
export function importPrivateKey(jwk: JsonWebKey, extractable = false): Promise<CryptoKey> {
  return subtle().importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, extractable, ["deriveBits"]);
}

// ── ECDH + HKDF → AES-GCM key-encryption key ──
async function deriveKEK(myPrivate: CryptoKey, theirPublic: CryptoKey): Promise<CryptoKey> {
  const shared = await subtle().deriveBits({ name: "ECDH", public: theirPublic }, myPrivate, 256);
  const hkdf = await subtle().importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: KEK_INFO },
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ── thread key (AES-GCM-256) ──
export function generateThreadKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function aesEncrypt(key: CryptoKey, data: Uint8Array): Promise<Sealed> {
  const iv = randomIv();
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, key, new Uint8Array(data));
  return { iv: bytesToB64(iv), ct: bytesToB64(ct) };
}
async function aesDecrypt(key: CryptoKey, sealed: Sealed): Promise<Uint8Array<ArrayBuffer>> {
  const pt = await subtle().decrypt({ name: "AES-GCM", iv: b64ToBytes(sealed.iv) }, key, b64ToBytes(sealed.ct));
  return new Uint8Array(pt);
}

/** Wrap a thread key FOR a recipient: KEK = HKDF(ECDH(myPriv, recipientPub)). */
export async function wrapThreadKey(threadKey: CryptoKey, myPrivate: CryptoKey, recipientPublic: CryptoKey): Promise<Sealed> {
  const kek = await deriveKEK(myPrivate, recipientPublic);
  const raw = new Uint8Array(await subtle().exportKey("raw", threadKey));
  return aesEncrypt(kek, raw);
}
/** Unwrap a thread key wrapped for me: KEK = HKDF(ECDH(myPriv, wrapperPub)). */
export async function unwrapThreadKey(sealed: Sealed, myPrivate: CryptoKey, wrapperPublic: CryptoKey): Promise<CryptoKey> {
  const kek = await deriveKEK(myPrivate, wrapperPublic);
  const raw = await aesDecrypt(kek, sealed);
  return subtle().importKey("raw", raw, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

// ── message + attachment payloads ──
export async function encryptText(threadKey: CryptoKey, text: string): Promise<Sealed> {
  return aesEncrypt(threadKey, enc(text));
}
export async function decryptText(threadKey: CryptoKey, sealed: Sealed): Promise<string> {
  return new TextDecoder().decode(await aesDecrypt(threadKey, sealed));
}
export async function encryptBytes(threadKey: CryptoKey, bytes: Uint8Array): Promise<Sealed> {
  return aesEncrypt(threadKey, bytes);
}
export async function decryptBytes(threadKey: CryptoKey, sealed: Sealed): Promise<Uint8Array> {
  return aesDecrypt(threadKey, sealed);
}

// ── recovery: PBKDF2(phrase) → AES-GCM KEK, wrapping the identity private key ──
export type RecoveryBlob = { v: 1; salt: string; iterations: number; iv: string; ct: string };

async function deriveRecoveryKEK(phrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", enc(phrase.normalize("NFKD")), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", salt: new Uint8Array(salt), iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function wrapPrivateKeyForRecovery(privateJwk: JsonWebKey, phrase: string): Promise<string> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const kek = await deriveRecoveryKEK(phrase, salt, RECOVERY_ITERATIONS);
  const sealed = await aesEncrypt(kek, enc(JSON.stringify(privateJwk)));
  const blob: RecoveryBlob = { v: 1, salt: bytesToB64(salt), iterations: RECOVERY_ITERATIONS, iv: sealed.iv, ct: sealed.ct };
  return bytesToB64(te.encode(JSON.stringify(blob)));
}

export async function unwrapPrivateKeyFromRecovery(blobB64: string, phrase: string): Promise<JsonWebKey> {
  const blob = JSON.parse(new TextDecoder().decode(b64ToBytes(blobB64))) as RecoveryBlob;
  const kek = await deriveRecoveryKEK(phrase, b64ToBytes(blob.salt), blob.iterations);
  const bytes = await aesDecrypt(kek, { iv: blob.iv, ct: blob.ct });
  return JSON.parse(new TextDecoder().decode(bytes)) as JsonWebKey;
}
