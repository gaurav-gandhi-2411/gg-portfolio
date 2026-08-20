"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/**
 * Loaded only once the section is approaching the viewport, same IntersectionObserver
 * pattern as components/triageiq/retrieval-space.tsx. No WebGL and no large data file
 * here (the grid is a few hundred numbers), so this exists purely for code-splitting,
 * not for a capability gate.
 */
const PowerGridClient = dynamic(() => import("./power-grid-client"), {
  ssr: false,
  loading: () => null,
});

/**
 * `children` is the full server-rendered set of tables (PowerGridStatic), so the
 * page carries every number before any JavaScript runs and stays complete if none
 * ever does. What the client adds is a picker that filters to one row/n at a time
 * and pins the real-evalset point against whatever is currently selected -- never
 * a number the static tables do not already show.
 */
export function PowerGridFrame({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return <div ref={containerRef}>{active ? <PowerGridClient /> : children}</div>;
}
