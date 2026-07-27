import { describe, expect, it } from 'vitest';
import { readIsoBmffDuration } from '../isoBmffDuration';
import { readEbmlDuration } from '../ebmlDuration';
import {
  checkVideoForComposer,
  MAX_VIDEO_SECONDS,
  readVideoDuration,
} from '../readVideoDuration';

// ---------------------------------------------------------------------------
// Container builders — real byte layouts, no binary fixtures, no ffmpeg in CI.
// ---------------------------------------------------------------------------

const enc = new TextEncoder();

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
}

function u64(n: number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n));
  return b;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Blob from raw bytes, via ArrayBuffer so this compiles on any TS 5.x
 *  (TS 5.7 made Uint8Array generic over its buffer type). */
function blobOf(...parts: Uint8Array[]): Blob {
  const merged = concat(...parts);
  const copy = new ArrayBuffer(merged.length);
  new Uint8Array(copy).set(merged);
  return new Blob([copy]);
}

/** [size][type][payload] */
function box(type: string, payload: Uint8Array): Uint8Array {
  return concat(u32(payload.length + 8), enc.encode(type), payload);
}

/** 64-bit form: [1][type][largesize][payload] */
function box64(type: string, payload: Uint8Array): Uint8Array {
  return concat(u32(1), enc.encode(type), u64(payload.length + 16), payload);
}

function mvhdV0(timescale: number, duration: number): Uint8Array {
  return box('mvhd', concat(
    new Uint8Array([0, 0, 0, 0]),      // version 0 + flags
    u32(0), u32(0),                     // creation, modification
    u32(timescale), u32(duration),
    new Uint8Array(80),                 // rate, volume, matrix, next_track_id
  ));
}

function mvhdV1(timescale: number, duration: number): Uint8Array {
  return box('mvhd', concat(
    new Uint8Array([1, 0, 0, 0]),      // version 1 + flags
    u64(0), u64(0),                     // creation, modification
    u32(timescale), u64(duration),
    new Uint8Array(80),
  ));
}

const ftyp = box('ftyp', concat(enc.encode('isom'), u32(512), enc.encode('isomiso2')));

function mp4(moovPayload: Uint8Array, { moovAtEnd = false, mdatBytes = 4096 } = {}): Blob {
  const moov = box('moov', moovPayload);
  const mdat = box('mdat', new Uint8Array(mdatBytes));
  return moovAtEnd ? blobOf(ftyp, mdat, moov) : blobOf(ftyp, moov, mdat);
}

/** Minimal trak carrying a tkhd track_id and an mdhd timescale. */
function trak(trackId: number, timescale: number): Uint8Array {
  const tkhd = box('tkhd', concat(
    new Uint8Array([0, 0, 0, 7]),
    u32(0), u32(0), u32(trackId), u32(0), u32(0),
    new Uint8Array(60),
  ));
  const mdhd = box('mdhd', concat(
    new Uint8Array([0, 0, 0, 0]),
    u32(0), u32(0), u32(timescale), u32(0),
    new Uint8Array(4),
  ));
  return box('trak', concat(tkhd, box('mdia', mdhd)));
}

// -- EBML ------------------------------------------------------------------

const EBML_HEADER = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x84, 0x42, 0x86, 0x81, 0x01]);

/** Single-byte-length EBML element. */
function ebml(id: number[], payload: Uint8Array): Uint8Array {
  return concat(new Uint8Array(id), new Uint8Array([0x80 | payload.length]), payload);
}

function f64(n: number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setFloat64(0, n);
  return b;
}

function webm(durationTicks: number, timestampScale = 1_000_000): Blob {
  const info = ebml([0x15, 0x49, 0xa9, 0x66], concat(
    ebml([0x2a, 0xd7, 0xb1], u32(timestampScale)),
    ebml([0x44, 0x89], f64(durationTicks)),
  ));
  const segment = ebml([0x18, 0x53, 0x80, 0x67], info);
  return blobOf(EBML_HEADER, segment);
}

// ---------------------------------------------------------------------------

describe('readIsoBmffDuration', () => {
  it('reads a version 0 mvhd', async () => {
    await expect(readIsoBmffDuration(mp4(mvhdV0(1000, 3000)))).resolves.toBeCloseTo(3, 5);
  });

  it('reads a version 1 mvhd with 64-bit duration', async () => {
    await expect(readIsoBmffDuration(mp4(mvhdV1(90000, 90000 * 12)))).resolves.toBeCloseTo(12, 5);
  });

  it('reads a non-round timescale exactly', async () => {
    await expect(readIsoBmffDuration(mp4(mvhdV0(30000, 90090)))).resolves.toBeCloseTo(3.003, 5);
  });

  // The regression that matters: a file without +faststart. Two of the three
  // files in the D-042 repro were this shape.
  it('reads moov positioned AFTER mdat (no faststart)', async () => {
    await expect(
      readIsoBmffDuration(mp4(mvhdV0(1000, 7500), { moovAtEnd: true })),
    ).resolves.toBeCloseTo(7.5, 5);
  });

  it('does not read the mdat payload to find a trailing moov', async () => {
    let bytesRead = 0;
    const blob = mp4(mvhdV0(1000, 3000), { moovAtEnd: true, mdatBytes: 8 * 1024 * 1024 });
    const counting = new Proxy(blob, {
      get(target, prop, receiver) {
        if (prop === 'slice') {
          return (start = 0, end = target.size) => {
            bytesRead += end - start;
            return Reflect.get(target, 'slice', receiver).call(target, start, end);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as Blob;
    await expect(readIsoBmffDuration(counting)).resolves.toBeCloseTo(3, 5);
    expect(bytesRead).toBeLessThan(64 * 1024);
  });

  it('handles 64-bit box sizes', async () => {
    const moov = box64('moov', mvhdV0(1000, 5000));
    await expect(readIsoBmffDuration(blobOf(ftyp, moov))).resolves.toBeCloseTo(5, 5);
  });

  it('falls back to mvex/mehd when mvhd duration is 0 (fragmented)', async () => {
    const mehd = box('mehd', concat(new Uint8Array([0, 0, 0, 0]), u32(4500)));
    const moov = concat(mvhdV0(1000, 0), box('mvex', mehd));
    await expect(readIsoBmffDuration(mp4(moov))).resolves.toBeCloseTo(4.5, 5);
  });

  it('sums fragment durations when mvhd and mehd are both absent', async () => {
    const trex = box('trex', concat(
      new Uint8Array([0, 0, 0, 0]), u32(1), u32(1), u32(512), u32(0), u32(0),
    ));
    const moov = box('moov', concat(mvhdV0(1000, 0), trak(1, 1024), box('mvex', trex)));

    // tfhd: flags 0x000008 (default-sample-duration-present), track_id 1
    const tfhd = box('tfhd', concat(u32(0x00000008), u32(1), u32(512)));
    // trun: flags 0 (no per-sample data), 4 samples -> 4 * 512 ticks
    const trun = box('trun', concat(u32(0), u32(4)));
    const moof = box('moof', box('traf', concat(tfhd, trun)));

    const blob = blobOf(ftyp, moov, moof, box('mdat', new Uint8Array(64)));
    // 4 samples * 512 ticks / 1024 timescale = 2s
    await expect(readIsoBmffDuration(blob)).resolves.toBeCloseTo(2, 5);
  });

  it('returns null rather than a partial sum when a fragment omits durations', async () => {
    const moov = box('moov', concat(mvhdV0(1000, 0), trak(1, 1024)));
    const tfhd = box('tfhd', concat(u32(0), u32(1)));   // no default duration
    const trun = box('trun', concat(u32(0), u32(4)));   // no per-sample duration
    const moof = box('moof', box('traf', concat(tfhd, trun)));
    await expect(
      readIsoBmffDuration(blobOf(ftyp, moov, moof)),
    ).resolves.toBeNull();
  });

  it.each([
    ['empty blob', new Blob([])],
    ['plain text', blobOf(enc.encode('this is not a video'.repeat(64)))],
    ['truncated header', blobOf(ftyp.slice(0, 6))],
    ['moov with no mvhd', mp4(box('udta', new Uint8Array(16)))],
  ])('returns null for %s without throwing', async (_label, blob) => {
    await expect(readIsoBmffDuration(blob)).resolves.toBeNull();
  });
});

describe('readEbmlDuration', () => {
  it('reads Duration with the default TimestampScale', async () => {
    await expect(readEbmlDuration(webm(3008))).resolves.toBeCloseTo(3.008, 5);
  });

  it('honours a non-default TimestampScale', async () => {
    await expect(readEbmlDuration(webm(3_000_000, 1000))).resolves.toBeCloseTo(3, 5);
  });

  it('returns null for a non-EBML blob', async () => {
    await expect(readEbmlDuration(new Blob([enc.encode('nope')]))).resolves.toBeNull();
  });
});

describe('readVideoDuration', () => {
  it('reports which reader produced the answer', async () => {
    await expect(
      readVideoDuration(mp4(mvhdV0(1000, 3000)), { skipElementFallback: true }),
    ).resolves.toEqual({ ok: true, seconds: 3, source: 'iso-bmff' });
  });

  it('recovers when the MIME type is wrong or missing', async () => {
    const mislabelled = new File([mp4(mvhdV0(1000, 3000))], 'clip.webm', { type: 'video/webm' });
    const result = await readVideoDuration(mislabelled, { skipElementFallback: true });
    expect(result).toEqual({ ok: true, seconds: 3, source: 'iso-bmff' });
  });

  it('reports unreadable rather than guessing', async () => {
    await expect(
      readVideoDuration(blobOf(enc.encode('garbage')), { skipElementFallback: true }),
    ).resolves.toEqual({ ok: false, reason: 'unreadable' });
  });
});

describe('checkVideoForComposer', () => {
  const opts = { skipElementFallback: true } as const;

  it('accepts a video under the limit', async () => {
    const r = await checkVideoForComposer(mp4(mvhdV0(1000, 3000)), opts);
    expect(r.status).toBe('ok');
  });

  it('accepts a video a hair over 90s (encoder rounding)', async () => {
    const r = await checkVideoForComposer(mp4(mvhdV0(1000, 90_033)), opts);
    expect(r.status).toBe('ok');
  });

  it('rejects a genuinely long video', async () => {
    const r = await checkVideoForComposer(mp4(mvhdV0(1000, 95_000)), opts);
    expect(r.status).toBe('too_long');
    if (r.status === 'too_long') expect(r.seconds).toBeCloseTo(95, 5);
  });

  it('rejects exactly at the boundary plus tolerance', async () => {
    const justOver = (MAX_VIDEO_SECONDS + 1) * 1000;
    const r = await checkVideoForComposer(mp4(mvhdV0(1000, justOver)), opts);
    expect(r.status).toBe('too_long');
  });

  // This is the D-042 defect itself, as a test.
  it('distinguishes unreadable from too_long', async () => {
    const r = await checkVideoForComposer(blobOf(enc.encode('garbage')), opts);
    expect(r.status).toBe('unreadable');
    expect(r.status).not.toBe('too_long');
  });
});
