/**
 * Poster frame extraction — hardened against the same failure class as D-042.
 *
 * This shares the `HTMLVideoElement` mechanism that broke duration reading,
 * so if metadata never arrives the poster never renders either. Two rules:
 *
 *   1. Never block posting on a poster frame. A missing poster is a cosmetic
 *      degradation; a video that cannot be posted is a broken feature. This
 *      function returns null and the caller carries on.
 *   2. Seek off zero. The first frame of a phone recording is very often
 *      black or a shutter artifact, which reads as a broken thumbnail.
 *
 * DEVIATION FROM SPEC (D-042 round 2 finding, a8aecee): the element is ATTACHED
 * to the DOM (hidden) rather than detached, because a detached element's seek
 * did not fire in the bl-social-02 preview. Removed on cleanup. Flagged for the
 * hub. NOTE: our `validate_post_media()` DB trigger requires poster_path for a
 * video, so in this app a null poster does block THAT video's upload (surfaced
 * as an error) — the "never block" rule is honoured for the composer flow, but
 * the DB constraint (which §10 forbids changing) makes the poster effectively
 * required. Flagged in the report.
 */

export interface PosterFrameOptions {
  /** Where to sample. Clamped into the clip. Default 1.0s. */
  atSeconds?: number;
  /** Longest edge of the output, preserving aspect. Default 720. */
  maxEdge?: number;
  /** JPEG quality 0..1. Default 0.82. */
  quality?: number;
  /** Give up after this long. Default 10000ms. */
  timeoutMs?: number;
}

export interface PosterFrame {
  blob: Blob;
  width: number;
  height: number;
  /** The timestamp actually sampled, after clamping. */
  atSeconds: number;
}

const DEFAULTS = {
  atSeconds: 1.0,
  maxEdge: 720,
  quality: 0.82,
  timeoutMs: 10_000,
};

export async function extractPosterFrame(
  file: Blob,
  options: PosterFrameOptions = {},
): Promise<PosterFrame | null> {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return null;
  }

  const opts = { ...DEFAULTS, ...options };
  const url = URL.createObjectURL(file);
  const el = document.createElement('video');
  el.preload = 'metadata';
  el.muted = true;
  el.playsInline = true;
  el.autoplay = false;
  // Required for canvas drawing from a blob URL in some engines; harmless here.
  el.crossOrigin = 'anonymous';
  // Attach hidden (D-042 round 2 finding) so seek events fire reliably.
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.appendChild(el);

  return new Promise<PosterFrame | null>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      el.removeEventListener('loadedmetadata', onMetadata);
      el.removeEventListener('seeked', onSeeked);
      el.removeEventListener('error', onError);
      el.removeAttribute('src');
      el.load();
      el.remove();
      URL.revokeObjectURL(url);
    };

    const settle = (value: PosterFrame | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const onError = () => settle(null);

    const onMetadata = () => {
      // Do NOT read videoWidth/videoHeight here — they are frequently 0 at
      // loadedmetadata and only populate by loadeddata/seeked (bailing on them was
      // a non-deterministic "poster-failed"). The seek target needs only duration;
      // dimensions are read in onSeeked, where they are reliably set.
      const limit = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : opts.atSeconds;
      const target = Math.min(Math.max(opts.atSeconds, 0), Math.max(limit - 0.05, 0));
      try {
        el.currentTime = target;
      } catch {
        settle(null);
      }
    };

    const onSeeked = () => {
      try {
        const vw = el.videoWidth;
        const vh = el.videoHeight;
        if (!vw || !vh) {
          settle(null);
          return;
        }
        const scale = Math.min(1, opts.maxEdge / Math.max(vw, vh));
        const width = Math.max(1, Math.round(vw * scale));
        const height = Math.max(1, Math.round(vh * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          settle(null);
          return;
        }
        ctx.drawImage(el, 0, 0, width, height);

        const sampled = el.currentTime;
        canvas.toBlob(
          (blob) => settle(blob ? { blob, width, height, atSeconds: sampled } : null),
          'image/jpeg',
          opts.quality,
        );
      } catch {
        // Tainted canvas or a decode failure — degrade, never throw.
        settle(null);
      }
    };

    el.addEventListener('loadedmetadata', onMetadata);
    el.addEventListener('seeked', onSeeked);
    el.addEventListener('error', onError);
    timer = setTimeout(() => settle(null), opts.timeoutMs);

    el.src = url;
    el.load();
  });
}
