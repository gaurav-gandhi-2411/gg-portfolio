"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const HeatToy = dynamic(() => import("./heat-toy").then((m) => m.HeatToy), {
  loading: () => <p className="text-sm text-muted-foreground">Loading today&apos;s word…</p>,
});

/**
 * Deliberately tiny — this is the only part of the hero interaction that
 * ships in the eager bundle. The real component (cosine-sim logic + the
 * ~41KB vocab fetch) only loads once the visitor actually engages, so the
 * "most memorable element" costs nothing for visitors who never touch it.
 */
export function HeroHeatToyShell() {
  const [activated, setActivated] = useState(false);

  if (activated) {
    return <HeatToy />;
  }

  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span aria-hidden>🔥</span>
      Play Warmer&apos;s mechanic — guess today&apos;s hidden word
    </button>
  );
}
