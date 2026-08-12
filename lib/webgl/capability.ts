/**
 * Decides whether a visitor gets the WebGL layer at all.
 *
 * The rule this encodes: the static SVG is the product, and WebGL is an
 * enhancement that has to earn its place on each specific device. So this
 * function answers "may we opt in?" — never "must we fall back?". Anything
 * unknown, unsupported, or merely suspicious resolves to static.
 *
 * Deliberately does NOT probe for a WebGL context here. Creating a throwaway
 * context to ask "is WebGL supported?" costs a real context on machines with
 * a small context budget, and can evict another one on the page. The caller
 * creates exactly one context on the canvas it intends to draw into, and
 * treats a null result as "stay static".
 */

// navigator.deviceMemory is Chromium-only and absent from the DOM lib types.
interface CapabilityNavigator extends Navigator {
  deviceMemory?: number;
}

/** Approximate device-memory floor, in GB, below which we stay static. */
const MIN_DEVICE_MEMORY_GB = 4;
/** Logical-core floor; <= this many cores stays static. */
const MAX_LOW_END_CORES = 4;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Low-end heuristic. Both signals are absent on some browsers (Safari reports
 * neither deviceMemory nor, historically, a useful hardwareConcurrency), and
 * absence is treated as "not known to be low-end" rather than "low-end" —
 * otherwise every Safari visitor loses the enhancement. The signals are only
 * ever used to EXCLUDE, never to require.
 */
export function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as CapabilityNavigator;

  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < MIN_DEVICE_MEMORY_GB) {
    return true;
  }
  if (
    typeof nav.hardwareConcurrency === "number" &&
    nav.hardwareConcurrency > 0 &&
    nav.hardwareConcurrency <= MAX_LOW_END_CORES
  ) {
    return true;
  }
  return false;
}

/**
 * The single gate the components call. Ordered cheapest-first, and every
 * branch fails toward the static layer.
 */
export function mayUseWebGL(): boolean {
  if (typeof window === "undefined") return false;
  if (prefersReducedMotion()) return false;
  if (isLowEndDevice()) return false;
  return true;
}

/**
 * Device-pixel-ratio ceiling for GL canvases. A 419-point cloud is
 * fragment-bound at DPR 3 on phones for no visual gain — the points are soft
 * circular sprites, so past ~2x the extra samples land inside the same
 * feathered edge.
 */
export const MAX_DEVICE_PIXEL_RATIO = 2;

export function cappedDevicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
}
