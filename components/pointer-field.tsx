"use client";

import { useEffect } from "react";

import { setPointerState } from "@/lib/pointer";

/**
 * The single pointer listener on the site.
 *
 * Renders nothing. It attaches one passive listener, smooths the position,
 * and writes it once per frame to the element that actually reads it.
 *
 * It used to write five custom properties to <html> every frame, and that was
 * the single largest cost on the page. Custom properties inherit, so setting
 * one on the root invalidates the computed style of the whole document, and
 * an unregistered one gives the engine no way to narrow that down. Measured
 * on the deployed page, same element, same frame: a regular property on
 * <html> costs 0.2ms, one custom property costs 17.3ms, and the same custom
 * property on a leaf costs nothing. During the first three seconds, while the
 * hero's SSR'd point cloud is still in the DOM and the tree is more than twice
 * this size, that per-frame cost was consuming most of the main thread.
 *
 * There is exactly one CSS consumer, .hero-spotlight, and it has no
 * descendants, so the write goes there instead. --mdx/--mdy are not written
 * as CSS at all any more: nothing in any stylesheet reads them, only the GL
 * layer does, and it reads them from setPointerState.
 *
 * It writes inline styles on a node React rendered, which React does not own
 * the contents of. That is the whole reason this is a style write and not a
 * DOM write: nothing here inserts, removes or reparents a node, which is the
 * rule that came out of the round-nine crash. Setting a custom property on an
 * element React rendered is invisible to the reconciler and always has been.
 *
 * Reduced-motion visitors never get a listener at all, and the tokens keep
 * their centred defaults, so every layer downstream renders its resting
 * composition rather than a broken one.
 */

/**
 * Per-frame approach rate. At 0.12 the layer arrives within a pixel or two
 * of the cursor in about a fifth of a second, which reads as weight rather
 * than as lag. Tuned by feel, which is the only way this value can be
 * chosen.
 */
const FOLLOW = 0.12;
/** How fast --pointer-on fades the whole effect in and out. */
const STRENGTH_FOLLOW = 0.06;

export function PointerField() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // The one element whose CSS reads --mx/--my/--pointer-on. Looked up once;
    // if the route has no hero the JS side still runs, because the GL layer
    // reads the same values through setPointerState rather than through CSS.
    const spotlight = document.querySelector<HTMLElement>(".hero-spotlight");

    let targetX = 0.5;
    let targetY = 0.5;
    let targetStrength = 0;
    let x = 0.5;
    let y = 0.5;
    let strength = 0;
    let frame: number | null = null;
    let idleFrames = 0;

    const write = () => {
      if (spotlight) {
        spotlight.style.setProperty("--mx", x.toFixed(4));
        spotlight.style.setProperty("--my", y.toFixed(4));
        spotlight.style.setProperty("--pointer-on", strength.toFixed(4));
      }
      setPointerState(x, y, x - 0.5, y - 0.5, strength);
    };

    const step = () => {
      const dx = targetX - x;
      const dy = targetY - y;
      const ds = targetStrength - strength;
      x += dx * FOLLOW;
      y += dy * FOLLOW;
      strength += ds * STRENGTH_FOLLOW;
      write();

      // Park the loop once we have settled, and let the next pointer event
      // restart it. An always-on rAF for a value that is not changing is
      // the cost this whole design is trying to avoid paying.
      const settled = Math.abs(dx) < 0.0002 && Math.abs(dy) < 0.0002 && Math.abs(ds) < 0.0004;
      idleFrames = settled ? idleFrames + 1 : 0;
      if (idleFrames > 4) {
        frame = null;
        return;
      }
      frame = requestAnimationFrame(step);
    };

    const kick = () => {
      if (frame === null) frame = requestAnimationFrame(step);
    };

    const onMove = (event: PointerEvent) => {
      // Touch sends a pointermove on every tap, which would leave the field
      // frozen wherever the last tap landed. Only devices with a cursor
      // that actually hovers drive this.
      if (event.pointerType === "touch") return;
      targetX = event.clientX / window.innerWidth;
      targetY = event.clientY / window.innerHeight;
      targetStrength = 1;
      kick();
    };

    const onLeave = () => {
      targetStrength = 0;
      kick();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      if (frame !== null) cancelAnimationFrame(frame);
      spotlight?.style.removeProperty("--mx");
      spotlight?.style.removeProperty("--my");
      spotlight?.style.removeProperty("--pointer-on");
    };
  }, []);

  return null;
}
