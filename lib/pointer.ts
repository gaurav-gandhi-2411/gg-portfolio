/**
 * One pointer position, shared by everything on the page that reacts to it.
 *
 * Two consumers with different needs, so this exposes both forms:
 *
 *   CSS layers (spotlight, parallax planes) read --mx/--my/--mdx/--mdy off
 *   the root element and never touch JavaScript. Writing custom properties
 *   once per frame and letting the compositor do the rest is the cheapest
 *   version of this effect that exists.
 *
 *   The WebGL field reads getPointer() directly. It could read the same
 *   custom properties, but that would mean a getComputedStyle call inside
 *   the render loop every frame, which is a forced style recalculation for
 *   a number we already have in memory.
 *
 * Values are normalized 0..1 across the viewport. The smoothed pair is what
 * gets published: raw pointer coordinates make a parallax layer feel welded
 * to the cursor, and the whole point of the effect is that the page has
 * some mass. Smoothing is a plain exponential lerp rather than a spring,
 * because a spring's overshoot on a layer that tracks the cursor reads as
 * the page lagging rather than as weight.
 */

export interface PointerState {
  /** Smoothed, normalized 0..1 across the viewport. */
  x: number;
  y: number;
  /** Smoothed, centred: -0.5 at one edge, 0.5 at the other. */
  dx: number;
  dy: number;
  /** Eases 0 to 1 while a real pointer is over the page. */
  strength: number;
}

const state: PointerState = { x: 0.5, y: 0.5, dx: 0, dy: 0, strength: 0 };

/**
 * Live pointer state. Returns the shared object rather than a copy: this is
 * read once per frame from a render loop, and allocating a fresh object per
 * frame for three numbers is exactly the kind of garbage that shows up as
 * jank later. Callers must treat it as read-only.
 */
export function getPointer(): Readonly<PointerState> {
  return state;
}

/** Only components/pointer-field.tsx calls this. */
export function setPointerState(x: number, y: number, dx: number, dy: number, strength: number) {
  state.x = x;
  state.y = y;
  state.dx = dx;
  state.dy = dy;
  state.strength = strength;
}
