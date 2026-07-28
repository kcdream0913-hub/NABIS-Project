/**
 * Poster frame extraction — hardened against the HTMLVideoElement failure class.
 *
 *   1. Load real FRAME data (preload="auto") and wait for `loadeddata`, so there
 *      is always a decodable frame — `preload="metadata"` gives none, which is
 *      why the seek stalled and returned null for a valid clip (D-042 round 4).
 *   2. Seek off zero for a nicer poster (frame 0 of a phone clip is often black),
 *      but FALL BACK to frame 0 if the seek never completes (single-keyframe GOP,
 *      a target on a frame boundary in a very short clip, or an engine that just
 *      doesn't fire `seeked`). A decodable video is therefore never blocked by
 *      poster generation — only a genuinely undecodable one returns null.
 *
 * DEVIATIONS FROM SPEC, flagged for the hub:
 *  - preload="auto" + `loadeddata` + a seek-with-frame-0-fallback (round 4) — the
 *    spec's preload="metadata" + seek-on-loadedmetadata is exactly what failed.
 *  - the element is DOM-ATTACHED (hidden), not detached (round 2, a8aecee) —
 *    detached seeks didn't fire in this preview. Removed on cleanup.
 *
 * NOTE: `validate_post_media()` requires poster_path for a video, so a null
 * poster still blocks THAT upload. With the frame-0 fallback that now happens
 * only for a video the browser cannot decode (which also could not play in the
 * feed) — so blocking it is the honest outcome, not a false rejection.
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
  // `preload="auto"` (not "metadata") so real FRAME data loads and `loadeddata`
  // gives us a drawable frame. From a blob URL the whole file is already in
  // memory, so this is not a network cost; it is what makes a frame available to
  // draw. (The feed PREVIEW <video> keeps preload="metadata" per D-038 — this is
  // the one-shot local extractor, a different element.)
  el.preload = 'auto';
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
    let seekTimer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      if (seekTimer !== undefined) clearTimeout(seekTimer);
      el.removeEventListener('loadeddata', onLoadedData);
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

    // Draw whatever frame is currently decoded. Guarded on readyState so we never
    // draw a blank frame. Used both after a successful seek AND as the fallback
    // when the seek never completes (frame 0 is a valid poster — this is what
    // stops a decodable video being blocked by poster generation, D-042 round 4).
    const draw = () => {
      if (settled) return;
      try {
        // HAVE_CURRENT_DATA — a frame at the current position is decodable.
        if (el.readyState < 2) {
          settle(null);
          return;
        }
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

    const onError = () => settle(null);

    const onLoadedData = () => {
      // A frame is now decodable. Try to seek to a nicer ~1s frame (frame 0 of a
      // phone clip is often black); if the seek does not complete — single-keyframe
      // GOP, a target on a frame boundary in a very short clip, or an engine that
      // just doesn't fire `seeked` here — fall back to the frame we already have.
      const limit = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : opts.atSeconds;
      const target = Math.min(Math.max(opts.atSeconds, 0), Math.max(limit - 0.05, 0));
      if (target <= 0.01) {
        draw(); // clip too short to seek meaningfully — use the first frame
        return;
      }
      seekTimer = setTimeout(draw, 1200); // seek didn't fire in time → frame 0
      try {
        el.currentTime = target;
      } catch {
        draw();
      }
    };

    const onSeeked = () => {
      if (seekTimer !== undefined) clearTimeout(seekTimer);
      draw();
    };

    el.addEventListener('loadeddata', onLoadedData);
    el.addEventListener('seeked', onSeeked);
    el.addEventListener('error', onError);
    timer = setTimeout(() => settle(null), opts.timeoutMs);

    el.src = url;
    el.load();
  });
}
