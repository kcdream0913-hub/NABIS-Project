/**
 * Video duration for the feed composer — D-042.
 *
 * Layered on purpose, cheapest and most reliable first:
 *
 *   1. Container bytes (`moov/mvhd` for MP4/MOV, `Segment>Info` for WebM).
 *      Deterministic, decoder-independent, a few KB of ranged reads.
 *   2. `HTMLVideoElement` metadata, with an Infinity workaround and a timeout.
 *      Covers containers step 1 does not parse.
 *
 * The caller never gets a number it cannot trust: the result is an explicit
 * union, and `unreadable` is a distinct outcome from `too_long`. Collapsing
 * those two was the original D-042 defect — a file whose length could not be
 * read was reported to the user as a file that was too long.
 */

import { isIsoBmffType, readIsoBmffDuration } from './isoBmffDuration';
import { isEbmlType, readEbmlDuration } from './ebmlDuration';
import { readElementDuration } from './elementDuration';

export type DurationSource = 'iso-bmff' | 'ebml' | 'element';

export type VideoDurationResult =
  | { ok: true; seconds: number; source: DurationSource }
  | { ok: false; reason: 'unreadable' };

export interface ReadVideoDurationOptions {
  /** Skip the DOM fallback (unit tests, workers, SSR). */
  skipElementFallback?: boolean;
  elementTimeoutMs?: number;
}

export async function readVideoDuration(
  file: File | Blob,
  options: ReadVideoDurationOptions = {},
): Promise<VideoDurationResult> {
  const hint = `${(file as File).name ?? ''} ${file.type ?? ''}`.trim().toLowerCase();

  // Try the matching container reader first, then the other one — the type
  // hint is a hint, not a guarantee. Browsers routinely report an empty
  // `type` for files picked from some Android file providers.
  const containerReaders: Array<[DurationSource, () => Promise<number | null>]> =
    isEbmlType(hint) && !isIsoBmffType(hint)
      ? [
          ['ebml', () => readEbmlDuration(file)],
          ['iso-bmff', () => readIsoBmffDuration(file)],
        ]
      : [
          ['iso-bmff', () => readIsoBmffDuration(file)],
          ['ebml', () => readEbmlDuration(file)],
        ];

  for (const [source, read] of containerReaders) {
    const seconds = await read();
    if (seconds !== null && Number.isFinite(seconds) && seconds > 0) {
      return { ok: true, seconds, source };
    }
  }

  if (options.skipElementFallback) return { ok: false, reason: 'unreadable' };

  const fromElement = await readElementDuration(file, {
    timeoutMs: options.elementTimeoutMs,
  });
  if (fromElement !== null && Number.isFinite(fromElement) && fromElement > 0) {
    return { ok: true, seconds: fromElement, source: 'element' };
  }

  return { ok: false, reason: 'unreadable' };
}

// ---------------------------------------------------------------------------
// Composer gate
// ---------------------------------------------------------------------------

/** D-038: one video, 90 seconds maximum. */
export const MAX_VIDEO_SECONDS = 90;

/**
 * Small tolerance so a file the user believes is exactly 90s is not rejected
 * on a rounding artifact. Container timescales rarely divide evenly — a "90s"
 * phone export commonly measures 90.033s.
 */
export const DURATION_TOLERANCE_SECONDS = 0.5;

export type VideoCheck =
  | { status: 'ok'; seconds: number; source: DurationSource }
  | { status: 'too_long'; seconds: number; source: DurationSource }
  | { status: 'unreadable' };

export async function checkVideoForComposer(
  file: File | Blob,
  options: ReadVideoDurationOptions = {},
): Promise<VideoCheck> {
  const result = await readVideoDuration(file, options);
  if (!result.ok) return { status: 'unreadable' };
  if (result.seconds > MAX_VIDEO_SECONDS + DURATION_TOLERANCE_SECONDS) {
    return { status: 'too_long', seconds: result.seconds, source: result.source };
  }
  return { status: 'ok', seconds: result.seconds, source: result.source };
}
