"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/**
 * Loaded only once the section is approaching the viewport. ssr:false keeps
 * both the interactive code and the ~34 KB projection out of the initial
 * payload; a visitor who never scrolls this far downloads none of it.
 */
const ItemSpaceClient = dynamic(() => import("./item-space-client"), {
  ssr: false,
  loading: () => null,
});

/**
 * Decides when the interactive item space replaces the server-rendered
 * results, using the same inversion as every other enhancement on this site:
 * the plain version ships in the HTML and is what everyone gets by default,
 * and the interactive one has to opt in.
 *
 * `children` is the server-rendered result list for every anchor, so the
 * page is complete before any JavaScript runs and stays complete if none
 * ever does. What the client adds is the picture and the ability to switch
 * anchors in place, not the content: every number a visitor could learn from
 * the interactive version is already in the HTML.
 *
 * Same pattern as components/triageiq/retrieval-space.tsx.
 */
export function ItemSpaceFrame({ children }: { children: React.ReactNode }) {
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

  return <div ref={containerRef}>{active ? <ItemSpaceClient /> : children}</div>;
}
