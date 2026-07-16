"use client";

import { useEffect, useState } from "react";

const LINE_INTERVAL_MS = 220;

interface BootSequenceProps {
  lines: readonly string[];
  children: React.ReactNode;
}

/**
 * Boot-sequence load: reveals `lines` one at a time, then swaps to the real
 * content. `prefers-reduced-motion` users land on the final state instantly,
 * enforced two independent ways so there's never a flash either way:
 *
 *   1. Pure CSS (`motion-reduce:` variants) hides the overlay and shows the
 *      content at first paint, before any JS has run.
 *   2. The mount effect also checks `window.matchMedia` and resolves
 *      straight to `done` if motion is reduced, so the reveal timers never
 *      start.
 *   3. A `<noscript>` override covers the no-JS case the same way.
 *
 * Follows the components/count-up-stat.tsx pattern: the initial `useState`
 * always matches what SSR rendered (booting, 0 lines shown), and every
 * subsequent update happens inside a `setTimeout` callback — never a bare
 * synchronous `setState` in the effect body — to avoid tripping
 * react-hooks/set-state-in-effect.
 */
export function BootSequence({ lines, children }: BootSequenceProps) {
  const [linesShown, setLinesShown] = useState(() => 0);
  const [done, setDone] = useState(() => false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      const id = setTimeout(() => {
        setLinesShown(lines.length);
        setDone(true);
      }, 0);
      return () => clearTimeout(id);
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function revealNext(nextIndex: number) {
      if (cancelled) return;
      setLinesShown(nextIndex);
      if (nextIndex >= lines.length) {
        setDone(true);
        return;
      }
      timeoutId = setTimeout(() => revealNext(nextIndex + 1), LINE_INTERVAL_MS);
    }

    timeoutId = setTimeout(() => revealNext(1), LINE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [lines]);

  return (
    <>
      <noscript>
        {/* No-JS fallback: the reveal timers above never run, so force the
            final state via plain CSS rather than leaving visitors stuck on
            the boot screen forever. */}
        <style>{`.b-boot-overlay{display:none!important}.b-boot-content{display:block!important}`}</style>
      </noscript>

      <div
        aria-hidden="true"
        className={
          done
            ? "b-boot-overlay hidden"
            : "b-boot-overlay flex min-h-screen flex-col justify-center bg-background px-6 py-10 motion-reduce:hidden"
        }
      >
        <div className="mx-auto flex w-full max-w-lg flex-col font-mono text-sm">
          {lines.slice(0, linesShown).map((line) => (
            <p key={line} className="py-0.5 text-foreground">
              {line}
            </p>
          ))}
          {linesShown < lines.length && (
            <span
              className="mt-1 inline-block h-4 w-2 animate-pulse bg-accent motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      <p className="sr-only" role="status">
        {done ? "" : "Loading console…"}
      </p>

      <div className={done ? "b-boot-content block" : "b-boot-content hidden motion-reduce:block"}>
        {children}
      </div>
    </>
  );
}
