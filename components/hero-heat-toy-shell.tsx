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
      className="font-heading flex w-full items-center gap-2 rounded-md border border-border bg-card px-4 py-3 text-left text-lg text-foreground italic transition-colors hover:border-accent/40 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span aria-hidden className="not-italic">
        🔥
      </span>
      Guess today&apos;s secret word
    </button>
  );
}
