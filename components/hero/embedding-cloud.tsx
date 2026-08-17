"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import { mayUseWebGL } from "@/lib/webgl/capability";

const EmbeddingCloudGL = dynamic(() => import("./embedding-cloud-gl"), {
  ssr: false,
  loading: () => null,
});

interface EmbeddingCloudProps {
  /** The server-rendered static scatter. Always in the SSR'd HTML. */
  children: React.ReactNode;
}

/**
 * Chooses between the hero's static SVG scatter and its ambient WebGL layer.
 *
 * This is the file two shipped components already pointed at in their own
 * docblocks ("components/hero/embedding-cloud.tsx decides which one to
 * render") before it existed — the decision was described and documented for
 * a while before anything actually made it.
 *
 * Same inversion as the Warmer viewer and the boot loader: the static layer
 * ships server-rendered and is the default; WebGL opts in per device, and
 * every failure path lands back on the static layer. Reduced-motion visitors
 * and low-end devices never create a context at all.
 *
 * WHEN it opts in is the part that was measured and changed. The field used to
 * mount on the frame after hydration, which put the whole of its setup inside
 * the load window. Bracketed on the deployed preview, n=5 each, same session,
 * with Vercel's Live toolbar blocked on every side:
 *
 *   production control                     86.4 +/- 4.72   TBT ~236ms
 *   preview, field mounting as before      64.6 +/- 2.70   TBT ~1006ms
 *   preview, field's chunk blocked         83.4 +/- 0.55   TBT ~132ms
 *
 * So the field was 18.8 of the roughly 22 points and effectively all of the
 * extra blocking time, and with it out of the way the hero's scroll-scrub
 * triggers sit inside the control's own noise band. The field is the signature
 * and stays; what changed is that it no longer competes with first paint.
 *
 * It now waits for the visitor to do something, or for the browser to go idle
 * after load, whichever comes first. Nothing is removed and nothing is
 * cheaper: this moves the work rather than deleting it, which is the honest
 * description and the reason the deferral was re-measured rather than assumed.
 *
 * Unlike the Warmer viewer there is no IntersectionObserver gate on mounting
 * here — the hero is above the fold, so it is on screen by definition. The GL
 * component does its own visibility-based pausing once mounted.
 */

/**
 * Anything that means a person is present. `scroll` is on the list because it
 * is the first thing that happens on a phone, where there is no cursor to
 * move, and a visitor who only ever scrolls must still get the field.
 */
const PRESENCE_EVENTS = ["pointerdown", "pointermove", "wheel", "touchstart", "keydown", "scroll"] as const;

/**
 * The earliest the field may arrive on its own, measured from `load`.
 *
 * A minimum, not a timeout, and the distinction is the whole point. The first
 * version of this passed 2500 to requestIdleCallback and read it as "wait up to
 * 2.5s". requestIdleCallback's timeout is a ceiling: it fires at the first idle
 * moment, and on an unthrottled machine the first idle moment after load is
 * immediate. Instrumented on a local production build, the field mounted 105ms
 * after load, which is squarely inside the window blocking time is measured in.
 * That would have moved the work without moving the number and looked like a
 * fix that was not one.
 *
 * So: wait this long after load, and only then ask for idle. The visitor who
 * never touches the page still gets the field, a beat after the page is theirs
 * to use.
 */
const UNPROMPTED_ARRIVAL_MS = 3000;

type Phase = "still" | "arriving" | "live";

/**
 * How long the still takes to hand over once the field is drawing. Matches
 * .hero-field-still's transition, and the still is only unmounted after it, so
 * nothing is pulled out from under a visible fade.
 */
const HANDOVER_MS = 700;

export function EmbeddingCloud({ children }: EmbeddingCloudProps) {
  const [phase, setPhase] = useState<Phase>("still");
  const [stillMounted, setStillMounted] = useState(true);

  const handleUnsupported = useCallback(() => {
    setStillMounted(true);
    setPhase("still");
  }, []);

  /**
   * The field has drawn real frames, so the still can hand over. Waiting for
   * this rather than for the mount is what makes it a cross-fade: for a moment
   * both layers are up, the field rising underneath a still on its way out.
   * Swapping at mount time, which is what this used to do, left a gap where
   * the hero showed neither, and that gap is the pop.
   */
  const handleFirstFrames = useCallback(() => {
    setPhase("live");
    window.setTimeout(() => setStillMounted(false), HANDOVER_MS);
  }, []);

  useEffect(() => {
    // The capability check needs window, so it cannot run during render, and a
    // useState initializer would desync hydration.
    if (!mayUseWebGL()) return;

    let armed = false;
    let idleHandle: number | null = null;
    let waitTimer: number | null = null;

    const arm = () => {
      if (armed) return;
      armed = true;
      teardown();
      setPhase("arriving");
    };

    const onLoadSettled = () => {
      waitTimer = window.setTimeout(() => {
        // Idle after the minimum, so the field slips into a gap rather than
        // competing with whatever the page is still finishing.
        const ric = window.requestIdleCallback;
        if (ric) idleHandle = ric(arm, { timeout: 1000 });
        else arm();
      }, UNPROMPTED_ARRIVAL_MS);
    };

    function teardown() {
      for (const type of PRESENCE_EVENTS) window.removeEventListener(type, arm);
      window.removeEventListener("load", onLoadSettled);
      if (idleHandle !== null) window.cancelIdleCallback?.(idleHandle);
      if (waitTimer !== null) window.clearTimeout(waitTimer);
    }

    for (const type of PRESENCE_EVENTS) {
      window.addEventListener(type, arm, { passive: true, once: true });
    }
    if (document.readyState === "complete") onLoadSettled();
    else window.addEventListener("load", onLoadSettled, { once: true });

    return teardown;
  }, []);

  return (
    <>
      {stillMounted && (
        <div className="hero-field-still" data-handed-over={phase === "live" ? "" : undefined}>
          {children}
        </div>
      )}
      {phase !== "still" && (
        <div className="hero-field-live">
          <EmbeddingCloudGL onUnsupported={handleUnsupported} onFirstFrames={handleFirstFrames} />
        </div>
      )}
    </>
  );
}
