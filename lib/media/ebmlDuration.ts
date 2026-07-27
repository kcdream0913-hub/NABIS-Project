/**
 * EBML / Matroska duration reader (WebM, MKV).
 *
 * Exists for one specific reason: `HTMLVideoElement.duration` returns
 * `Infinity` for WebM produced by MediaRecorder — the single most common
 * "we couldn't read this video's length" case in the wild. The container
 * still records the duration in `Segment > Info`, so we read it directly.
 *
 * Element layout: [VINT id][VINT size][payload]
 */

const MAX_SCAN_BYTES = 4 * 1024 * 1024; // Info sits near the head; cap the scan.
const MAX_ELEMENTS = 512;

const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_TIMESTAMP_SCALE = 0x2ad7b1;
const ID_DURATION = 0x4489;

/** Default TimestampScale per the Matroska spec: 1 ms expressed in nanoseconds. */
const DEFAULT_TIMESTAMP_SCALE = 1_000_000;

export function isEbmlType(mimeOrName: string): boolean {
  const v = mimeOrName.toLowerCase();
  return v === 'video/webm' || v === 'video/x-matroska' || /\.(webm|mkv)$/.test(v);
}

interface Vint {
  value: number;
  length: number;
  /** True when every value bit is 1 — Matroska's "unknown size" marker. */
  unknown: boolean;
}

/**
 * @param keepMarker IDs retain their leading marker bit; sizes strip it.
 */
function readVint(bytes: Uint8Array, offset: number, keepMarker: boolean): Vint | null {
  if (offset >= bytes.length) return null;
  const first = bytes[offset];
  if (first === 0) return null; // lengths >8 bytes are not supported (nor emitted)

  let length = 1;
  let mask = 0x80;
  while (length <= 8 && (first & mask) === 0) {
    mask >>= 1;
    length++;
  }
  if (length > 8 || offset + length > bytes.length) return null;

  let value = keepMarker ? first : first & (mask - 1);
  let allOnes = (first & (mask - 1)) === mask - 1;

  for (let i = 1; i < length; i++) {
    const byte = bytes[offset + i];
    value = value * 256 + byte;
    if (byte !== 0xff) allOnes = false;
  }
  if (!Number.isSafeInteger(value)) return null;
  return { value, length, unknown: allOnes };
}

function readUint(bytes: Uint8Array): number {
  let value = 0;
  for (const byte of bytes) value = value * 256 + byte;
  return value;
}

function readFloat(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length === 4) return view.getFloat32(0);
  if (bytes.length === 8) return view.getFloat64(0);
  if (bytes.length === 0) return null;
  return readUint(bytes); // some muxers write Duration as an integer
}

/** Walk sibling elements, descending into Segment and Info only. */
function scanForInfo(bytes: Uint8Array, start: number, end: number, depth: number):
  { scale: number; duration: number } | null {
  let offset = start;
  let scale: number | null = null;
  let duration: number | null = null;

  for (let i = 0; i < MAX_ELEMENTS && offset < end; i++) {
    const id = readVint(bytes, offset, true);
    if (!id) return null;
    const size = readVint(bytes, offset + id.length, false);
    if (!size) return null;

    const bodyStart = offset + id.length + size.length;
    const bodyEnd = size.unknown ? end : Math.min(bodyStart + size.value, end);

    if (id.value === ID_SEGMENT && depth === 0) {
      return scanForInfo(bytes, bodyStart, bodyEnd, depth + 1);
    }
    if (id.value === ID_INFO && depth === 1) {
      const inner = scanForInfo(bytes, bodyStart, bodyEnd, depth + 1);
      if (inner) return inner;
    }
    if (depth === 2) {
      if (id.value === ID_TIMESTAMP_SCALE) scale = readUint(bytes.subarray(bodyStart, bodyEnd));
      if (id.value === ID_DURATION) duration = readFloat(bytes.subarray(bodyStart, bodyEnd));
      if (scale !== null && duration !== null) break;
    }

    if (bodyEnd <= offset) return null; // no forward progress; bail rather than spin
    offset = bodyEnd;
  }

  if (duration === null) return null;
  return { scale: scale ?? DEFAULT_TIMESTAMP_SCALE, duration };
}

/** Returns duration in seconds, or null if not EBML / not recorded. */
export async function readEbmlDuration(blob: Blob): Promise<number | null> {
  try {
    const bytes = new Uint8Array(
      await blob.slice(0, Math.min(MAX_SCAN_BYTES, blob.size)).arrayBuffer(),
    );
    // EBML magic
    if (bytes.length < 4 || bytes[0] !== 0x1a || bytes[1] !== 0x45 || bytes[2] !== 0xdf || bytes[3] !== 0xa3) {
      return null;
    }
    const found = scanForInfo(bytes, 0, bytes.length, 0);
    if (!found) return null;
    const seconds = (found.duration * found.scale) / 1_000_000_000;
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
  } catch {
    return null;
  }
}
