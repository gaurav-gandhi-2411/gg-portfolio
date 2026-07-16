"use client";

import { useEffect, useState } from "react";

const LINE_INTERVAL_MS = 220;

interface BootSequenceProps {
  lines: readonly string[];
  children: React.ReactNode;
}

/**
 * Boot-sequence load: reveals `lines` one at a time, then swaps to the real
 * content. The real content is NEVER removed from the DOM/accessibility
 * tree — the overlay is a `fixed`, full-viewport layer painted ON TOP of it
 * while booting, not a `display:none` toggle on the content itself. Screen
 * readers and axe-style scans see the real heading/content immediately;
 * only the visual presentation is deferred. `prefers-reduced-motion` users
 * never see the overlay at all, enforced two independent ways:
 *
 *   1. Pure CSS (`motion-reduce:` variants) hides the overlay at first
 *      paint, before any JS has run.
 *   2. The mount effect also checks `window.matchMedia` and resolves
 *      straight to `done` if motion is reduced, so the reveal timers never
 *      start (the overlay is already hidden by (1) regardless).
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
            overlay hidden via plain CSS rather than leaving visitors stuck
            looking at it forever. The content underneath was always visible. */}
        <style>{`.b-boot-overlay{display:none!important}`}</style>
      </noscript>

      <div
        aria-hidden="true"
        className={
          done
            ? "hidden"
            : "b-boot-overlay fixed inset-0 z-50 flex flex-col justify-center bg-background px-6 py-10 motion-reduce:hidden"
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

      {children}
    </>
  );
}
