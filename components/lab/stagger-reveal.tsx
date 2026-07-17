"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lab 2 — staggered stream-in, per element (40-60ms cascade) instead of
 * wave 5's old per-section fade (which wave 6 deleted entirely, because its
 * IntersectionObserver + opacity:0-by-default approach left the whole page
 * blank without JS — reports/wave6-audit-2026-07-17.md finding 8).
 *
 * This uses the Web Animations API (`Element.animate()`) instead of a
 * CSS class toggle: the DOM's default state is fully visible (opacity 1,
 * no transform) — nothing is ever hidden by a stylesheet rule or a
 * pre-hydration className. `.animate()` with `fill: "backwards"` only
 * paints the hidden starting keyframe once it's actually invoked by JS
 * after IntersectionObserver confirms the browser can run it. No-JS,
 * slow-hydration, and reduced-motion users all get the plain, always-
 * visible content — the wave-6 bug class is structurally not reachable
 * here. (Study note: production sites' post-hydration DOM doesn't expose
 * reusable stagger timing via static inspection, so the 40-60ms figure
 * and ease curve below are a qualitative visual match to Vercel/Linear's
 * cascades, not an extracted constant — disclosed in the wave-8 report.)
 */
export function StaggerList({
  items,
  mode,
  stepMs = 50,
}: {
  items: string[];
  mode: "stagger" | "section";
  stepMs?: number;
}) {
  const containerRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [runToken, setRunToken] = useState(0);

  function run() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const kf: Keyframe[] = [
      { opacity: 0, transform: "translateY(10px)" },
      { opacity: 1, transform: "translateY(0)" },
    ];
    const easing = "cubic-bezier(0.16, 1, 0.3, 1)";
    if (mode === "section") {
      containerRef.current?.animate(kf, { duration: 400, easing, fill: "backwards" });
      return;
    }
    itemRefs.current.forEach((el, i) => {
      el?.animate(kf, { duration: 400, delay: i * stepMs, easing, fill: "backwards" });
    });
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <ul ref={containerRef} className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <li
            key={item}
            ref={(node) => {
              itemRefs.current[i] = node;
            }}
            className="border-border bg-card rounded-md border px-3 py-1.5 font-mono text-xs"
          >
            {item}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          setRunToken((t) => t + 1);
          run();
        }}
        className="text-muted-foreground hover:text-accent w-fit text-xs underline decoration-1 underline-offset-4"
      >
        Replay ({runToken})
      </button>
    </div>
  );
}
