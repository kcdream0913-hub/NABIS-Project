/**
 * ISO Base Media File Format duration reader (MP4 / M4V / MOV / 3GP).
 *
 * Reads the movie duration straight out of the container's `moov/mvhd` box
 * using ranged reads, so a 50 MB file costs a few KB of I/O and never touches
 * a decoder. This is deliberately independent of `HTMLVideoElement`: it works
 * for codecs the browser cannot decode (HEVC .mov from an iPhone is the common
 * case) and it cannot return Infinity or NaN the way `video.duration` can.
 *
 * Box layout: [uint32 size][char[4] type][payload]
 *   size === 1  -> a uint64 `largesize` follows the type
 *   size === 0  -> the box runs to end of file
 */

/** Hard ceilings so a hostile or corrupt file cannot make us loop or allocate. */
const MAX_TOP_LEVEL_BOXES = 64;
const MAX_MOOV_BYTES = 32 * 1024 * 1024; // 32 MB
const HEADER_PROBE_BYTES = 16; // enough for size + type + largesize

/** Container brands this reader claims. */
const ISO_BMFF_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/3gpp',
  'video/3gpp2',
  'audio/mp4',
]);

export function isIsoBmffType(mimeOrName: string): boolean {
  const v = mimeOrName.toLowerCase();
  if (ISO_BMFF_TYPES.has(v)) return true;
  return /\.(mp4|m4v|mov|qt|3gp|3g2)$/.test(v);
}

async function readRange(blob: Blob, start: number, end: number): Promise<Uint8Array> {
  const clampedEnd = Math.min(end, blob.size);
  if (start >= clampedEnd) return new Uint8Array(0);
  const buf = await blob.slice(start, clampedEnd).arrayBuffer();
  return new Uint8Array(buf);
}

interface BoxHeader {
  type: string;
  /** Total box size including the header. */
  size: number;
  /** Byte length of the header itself (8, or 16 for 64-bit sizes). */
  headerSize: number;
}

function parseBoxHeader(bytes: Uint8Array, fileRemaining: number): BoxHeader | null {
  if (bytes.length < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let size = view.getUint32(0);
  const type = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  let headerSize = 8;

  if (size === 1) {
    if (bytes.length < 16) return null;
    // getBigUint64 keeps 64-bit sizes exact; Number() is safe below 2^53.
    const large = view.getBigUint64(8);
    if (large > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    size = Number(large);
    headerSize = 16;
  } else if (size === 0) {
    // Box extends to end of file.
    size = fileRemaining;
  }

  if (size < headerSize) return null;
  if (!/^[\x20-\x7e]{4}$/.test(type)) return null; // not a plausible box type
  return { type, size, headerSize };
}

/**
 * Walk the top-level box list with 16-byte probes and return the `moov` bytes.
 * Handles moov-at-end (no faststart) without reading the mdat payload.
 */
async function locateMoov(blob: Blob): Promise<Uint8Array | null> {
  let offset = 0;
  for (let i = 0; i < MAX_TOP_LEVEL_BOXES; i++) {
    if (offset + 8 > blob.size) return null;
    const probe = await readRange(blob, offset, offset + HEADER_PROBE_BYTES);
    const header = parseBoxHeader(probe, blob.size - offset);
    if (!header) return null;

    if (header.type === 'moov') {
      if (header.size > MAX_MOOV_BYTES) return null;
      return readRange(blob, offset + header.headerSize, offset + header.size);
    }
    offset += header.size;
  }
  return null;
}

/** Depth-first search for a box type inside an already-materialised payload. */
function findBox(payload: Uint8Array, path: string[]): Uint8Array | null {
  if (path.length === 0) return payload;
  const [want, ...rest] = path;
  let offset = 0;
  while (offset + 8 <= payload.length) {
    const header = parseBoxHeader(payload.subarray(offset), payload.length - offset);
    if (!header) return null;
    const bodyStart = offset + header.headerSize;
    const bodyEnd = Math.min(offset + header.size, payload.length);
    if (header.type === want) {
      const body = payload.subarray(bodyStart, bodyEnd);
      return rest.length === 0 ? body : findBox(body, rest);
    }
    if (header.size <= 0) return null;
    offset += header.size;
  }
  return null;
}

/** `mvhd` -> { timescale, duration }. Handles version 0 (32-bit) and 1 (64-bit). */
function readMvhd(mvhd: Uint8Array): { timescale: number; duration: number } | null {
  if (mvhd.length < 4) return null;
  const view = new DataView(mvhd.buffer, mvhd.byteOffset, mvhd.byteLength);
  const version = mvhd[0];

  if (version === 1) {
    if (mvhd.length < 32) return null;
    const timescale = view.getUint32(20);
    const duration = Number(view.getBigUint64(24));
    return { timescale, duration };
  }
  if (version === 0) {
    if (mvhd.length < 20) return null;
    const timescale = view.getUint32(12);
    const duration = view.getUint32(16);
    return { timescale, duration };
  }
  return null;
}

/**
 * `mvex/mehd` fragment duration — the fallback for fragmented MP4, where
 * `mvhd.duration` is legitimately 0 because the media lives in `moof` boxes.
 */
function readMehd(moov: Uint8Array, timescale: number): number | null {
  const mehd = findBox(moov, ['mvex', 'mehd']);
  if (!mehd || mehd.length < 8) return null;
  const view = new DataView(mehd.buffer, mehd.byteOffset, mehd.byteLength);
  const version = mehd[0];
  const raw = version === 1 ? Number(view.getBigUint64(4)) : view.getUint32(4);
  if (!Number.isFinite(raw) || raw <= 0 || timescale <= 0) return null;
  return raw / timescale;
}

/** Iterate every sibling box in a payload. */
function* iterBoxes(payload: Uint8Array): Generator<{ type: string; body: Uint8Array }> {
  let offset = 0;
  while (offset + 8 <= payload.length) {
    const header = parseBoxHeader(payload.subarray(offset), payload.length - offset);
    if (!header || header.size <= 0) return;
    yield {
      type: header.type,
      body: payload.subarray(offset + header.headerSize, Math.min(offset + header.size, payload.length)),
    };
    offset += header.size;
  }
}

/** track_id -> media timescale, read from each trak's tkhd + mdhd. */
function readTrackTimescales(moov: Uint8Array): Map<number, number> {
  const out = new Map<number, number>();
  for (const box of iterBoxes(moov)) {
    if (box.type !== 'trak') continue;
    const tkhd = findBox(box.body, ['tkhd']);
    const mdhd = findBox(box.body, ['mdia', 'mdhd']);
    if (!tkhd || !mdhd || tkhd.length < 24 || mdhd.length < 20) continue;
    const tkView = new DataView(tkhd.buffer, tkhd.byteOffset, tkhd.byteLength);
    const mdView = new DataView(mdhd.buffer, mdhd.byteOffset, mdhd.byteLength);
    const trackId = tkhd[0] === 1 ? tkView.getUint32(20) : tkView.getUint32(12);
    const timescale = mdhd[0] === 1 ? mdView.getUint32(20) : mdView.getUint32(12);
    if (trackId > 0 && timescale > 0) out.set(trackId, timescale);
  }
  return out;
}

/** track_id -> trex default_sample_duration. */
function readTrexDefaults(moov: Uint8Array): Map<number, number> {
  const out = new Map<number, number>();
  const mvex = findBox(moov, ['mvex']);
  if (!mvex) return out;
  for (const box of iterBoxes(mvex)) {
    if (box.type !== 'trex' || box.body.length < 24) continue;
    const view = new DataView(box.body.buffer, box.body.byteOffset, box.body.byteLength);
    out.set(view.getUint32(4), view.getUint32(12));
  }
  return out;
}

const MAX_FRAGMENTS = 4096;

/**
 * Fragmented MP4 with no `mehd`: sum each fragment's sample durations.
 *
 * Returns null — never a partial total — if we hit the fragment cap or a
 * fragment omits duration information. An undercount here would let a video
 * longer than the limit through the length gate, and that failure is silent.
 */
async function sumFragmentDuration(blob: Blob, moov: Uint8Array): Promise<number | null> {
  const timescales = readTrackTimescales(moov);
  const trexDefaults = readTrexDefaults(moov);
  if (timescales.size === 0) return null;

  const ticks = new Map<number, number>();
  let offset = 0;
  let fragments = 0;

  while (offset + 8 <= blob.size) {
    const probe = await readRange(blob, offset, offset + HEADER_PROBE_BYTES);
    const header = parseBoxHeader(probe, blob.size - offset);
    if (!header) return null;

    if (header.type === 'moof') {
      if (++fragments > MAX_FRAGMENTS) return null;
      if (header.size > MAX_MOOV_BYTES) return null;
      const moof = await readRange(blob, offset + header.headerSize, offset + header.size);

      for (const box of iterBoxes(moof)) {
        if (box.type !== 'traf') continue;
        const tfhd = findBox(box.body, ['tfhd']);
        if (!tfhd || tfhd.length < 8) return null;
        const tfhdView = new DataView(tfhd.buffer, tfhd.byteOffset, tfhd.byteLength);
        const tfhdFlags = tfhdView.getUint32(0) & 0xffffff;
        const trackId = tfhdView.getUint32(4);

        let cursor = 8;
        if (tfhdFlags & 0x000001) cursor += 8; // base-data-offset
        if (tfhdFlags & 0x000002) cursor += 4; // sample-description-index
        let defaultDuration = trexDefaults.get(trackId) ?? 0;
        if (tfhdFlags & 0x000008) {
          if (tfhd.length < cursor + 4) return null;
          defaultDuration = tfhdView.getUint32(cursor);
          cursor += 4;
        }

        for (const inner of iterBoxes(box.body)) {
          if (inner.type !== 'trun' || inner.body.length < 8) continue;
          const trunView = new DataView(inner.body.buffer, inner.body.byteOffset, inner.body.byteLength);
          const trunFlags = trunView.getUint32(0) & 0xffffff;
          const sampleCount = trunView.getUint32(4);

          let p = 8;
          if (trunFlags & 0x000001) p += 4; // data-offset
          if (trunFlags & 0x000004) p += 4; // first-sample-flags

          const hasDuration = (trunFlags & 0x000100) !== 0;
          if (!hasDuration) {
            // Every sample uses the default; if there is none, we cannot total it.
            if (defaultDuration <= 0) return null;
            ticks.set(trackId, (ticks.get(trackId) ?? 0) + sampleCount * defaultDuration);
            continue;
          }

          const stride =
            4 +
            ((trunFlags & 0x000200) ? 4 : 0) +
            ((trunFlags & 0x000400) ? 4 : 0) +
            ((trunFlags & 0x000800) ? 4 : 0);
          if (p + sampleCount * stride > inner.body.length) return null;
          let total = 0;
          for (let s = 0; s < sampleCount; s++) {
            total += trunView.getUint32(p);
            p += stride;
          }
          ticks.set(trackId, (ticks.get(trackId) ?? 0) + total);
        }
      }
    }
    offset += header.size;
  }

  if (fragments === 0 || ticks.size === 0) return null;
  let longest = 0;
  for (const [trackId, total] of ticks) {
    const timescale = timescales.get(trackId);
    if (!timescale) return null;
    longest = Math.max(longest, total / timescale);
  }
  return longest > 0 ? longest : null;
}

/**
 * Returns duration in seconds, or null if this file is not ISO-BMFF or the
 * duration genuinely is not recoverable from the container.
 */
export async function readIsoBmffDuration(blob: Blob): Promise<number | null> {
  try {
    const moov = await locateMoov(blob);
    if (!moov) return null;

    const mvhd = findBox(moov, ['mvhd']);
    if (!mvhd) return null;
    const header = readMvhd(mvhd);
    if (!header || header.timescale <= 0) return null;

    // 0xFFFFFFFF is the "unknown duration" sentinel in version 0.
    const unknown = header.duration === 0 || header.duration === 0xffffffff;
    if (!unknown) {
      const seconds = header.duration / header.timescale;
      if (Number.isFinite(seconds) && seconds > 0) return seconds;
    }

    // Fragmented MP4: mvhd carries no duration. Try mvex/mehd, then the
    // fragment sum. Both are exact or null — never approximate.
    const declared = readMehd(moov, header.timescale);
    if (declared !== null) return declared;

    return await sumFragmentDuration(blob, moov);
  } catch {
    return null;
  }
}
