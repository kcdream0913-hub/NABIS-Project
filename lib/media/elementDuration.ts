/**
 * `HTMLVideoElement` duration reader — the FALLBACK path, not the primary one.
 *
 * Kept for containers the byte readers do not cover (AVI, OGG, exotic MOV
 * variants). It is second in line because it has three failure modes the
 * container readers do not:
 *
 *   1. It needs the browser to support the CODEC, not just the container.
 *      An iPhone HEVC .mov has a perfectly readable `mvhd` but will not
 *      produce metadata in a browser without HEVC support.
 *   2. `duration` can be `Infinity` (MediaRecorder output) or `NaN`.
 *   3. It can hang: no `loadedmetadata`, no `error`, no resolution.
 *
 * Every one of those is handled here, but "handled" means "fails cleanly",
 * which is why this runs second.
 *
 * DEVIATION FROM SPEC (D-042 round 2 finding, commit a8aecee): the element is
 * ATTACHED to the DOM (hidden), not detached. In the bl-social-02 preview a
 * detached element's seek (the Infinity workaround) never fired timeupdate/
 * durationchange, so the read hung. preload+load() alone did not fix it;
 * attaching did. Removed on cleanup. Flagged for the hub in the report.
 */

export interface ElementDurationOptions {
  /** Give up after this long. Default 8000ms. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 8_000;

/** Forces duration resolution on streams that report Infinity. */
const SEEK_BEYOND_END = 1e101;

function makeHiddenVideo(): HTMLVideoElement {
  const el = document.createElement('video');
  // `preload="metadata"` is what actually triggers the header fetch. Attaching
  // to the DOM (hidden) is what makes seek/durationchange fire reliably.
  el.preload = 'metadata';
  el.muted = true;
  el.playsInline = true;
  el.autoplay = false; // D-038 forbids autoplay; it would also download the file
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  document.body.appendChild(el);
  return el;
}

export async function readElementDuration(
  file: Blob,
  options: ElementDurationOptions = {},
): Promise<number | null> {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return null; // SSR / worker context
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = URL.createObjectURL(file);
  const el = makeHiddenVideo();

  return new Promise<number | null>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      el.removeEventListener('loadedmetadata', onMetadata);
      el.removeEventListener('durationchange', onDurationChange);
      el.removeEventListener('error', onError);
      // Order matters: detach the source BEFORE revoking, or Chrome logs a
      // media error for the in-flight load. Revoking too early is a known
      // cause of "metadata never arrives".
      el.removeAttribute('src');
      el.load();
      el.remove();
      URL.revokeObjectURL(url);
    };

    const settle = (value: number | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const usable = (d: number) => Number.isFinite(d) && d > 0;

    const onDurationChange = () => {
      if (usable(el.duration)) settle(el.duration);
    };

    const onMetadata = () => {
      if (usable(el.duration)) {
        settle(el.duration);
        return;
      }
      // Infinity / NaN: seek past the end so the browser scans for the real
      // end timestamp, then `durationchange` fires with a finite value.
      try {
        el.currentTime = SEEK_BEYOND_END;
      } catch {
        settle(null);
      }
    };

    const onError = () => settle(null);

    el.addEventListener('loadedmetadata', onMetadata);
    el.addEventListener('durationchange', onDurationChange);
    el.addEventListener('error', onError);

    timer = setTimeout(() => settle(null), timeoutMs);

    el.src = url;
    // Explicit load() rather than relying on the src setter's implicit one.
    el.load();
  });
}
