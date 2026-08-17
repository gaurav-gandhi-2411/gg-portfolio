"use client";

import { useEffect } from "react";

import { onPresenceOrIdle } from "@/lib/motion/after-first-paint";
import { loadMotion, prefersReducedMotion } from "@/lib/motion/gsap";

type Motion = Awaited<ReturnType<typeof loadMotion>>;

/**
 * Runs a GSAP setup once the animation system has arrived, and never before.
 *
 * Every consumer of GSAP on this site goes through here, so the deferral has one
 * implementation rather than five slightly different ones. What each of them used
 * to do was import gsap at module top and build its animations in a `useEffect`;
 * because two of those consumers sit in the root layout, that put 51,697 bytes of
 * gzip on every route whether anything animated or not, and eager JS came to
 * 245,355 bytes against a 220,160 ceiling.
 *
 * The shape of the contract:
 *
 *   Reduced motion never loads anything. The check happens here, before the
 *   dynamic import, rather than inside the work after the import has been paid.
 *
 *   The page is correct without it. Whatever `build` sets up is an enhancement,
 *   so a surface that has not received it yet must already look and behave
 *   sensibly. The nav is the test case: its active link is derived during render
 *   from the route, so the pill is right immediately and only the sliding
 *   indicator waits.
 *
 *   Teardown is safe at any point. `build` returns its own cleanup, and if the
 *   component unmounts before the load resolves, the cleanup below cancels the
 *   trigger and the resolved setup is discarded rather than attached to a
 *   detached tree.
 *
 * @param build   Receives gsap and ScrollTrigger; returns its cleanup.
 * @param deps    Same meaning as useEffect's.
 * @param minimumMs Earliest unprompted arrival, measured from `load`. A presence
 *                  event beats it.
 */
export function useDeferredMotion(
  build: (motion: Motion) => (() => void) | void,
  deps: unknown[],
  minimumMs = 1200
): void {
  useEffect(() => {
    if (prefersReducedMotion()) return;

    let cleanup: (() => void) | void;
    let cancelled = false;

    const cancelTrigger = onPresenceOrIdle(() => {
      void loadMotion().then((motion) => {
        // Unmounted while the chunk was in flight: do not build into a tree
        // React has already taken apart.
        if (cancelled) return;
        cleanup = build(motion);
      });
    }, minimumMs);

    return () => {
      cancelled = true;
      cancelTrigger();
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
