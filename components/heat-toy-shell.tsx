"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const HeatToy = dynamic(() => import("./heat-toy").then((m) => m.HeatToy), {
  loading: () => <p className="text-sm text-muted-foreground">Loading today&apos;s word…</p>,
});

/**
 * Deliberately tiny — this is the only part of the heat-toy interaction that
 * ships in the eager bundle. The real component (cosine-sim logic + the
 * ~41KB vocab fetch) only loads once the visitor actually engages, so the
 * "most memorable element" costs nothing for visitors who never touch it.
 * Wave 5: relocated from the hero to the Work section's Warmer annex.
 */
export function HeatToyShell() {
  const [activated, setActivated] = useState(false);

  if (activated) {
    return <HeatToy />;
  }

  return (
    // Text-styled trigger, not a boxed widget: after nine unboxed work rows a
    // bordered card read louder than anything around it (review fix). The
    // intro copy directly above sets up the affordance; the underline says
    // clickable in the same voice as every other link on the page.
    <button
      type="button"
      onClick={() => setActivated(true)}
      className="font-heading flex w-fit items-center gap-2 text-left text-lg text-foreground italic underline decoration-border decoration-1 underline-offset-4 transition-colors hover:decoration-accent focus-visible:decoration-accent motion-reduce:transition-none"
    >
      <span aria-hidden className="not-italic">
        🔥
      </span>
      Guess today&apos;s secret word
    </button>
  );
}
