"use client";

import { useState } from "react";
import { ScrollDrawFigure } from "@/components/lab/scroll-draw-figure";
import { products } from "@/content/products";

const flagship = products.filter((p) => p.tier === "flagship" && p.figure && p.metric);

export default function Lab5() {
  const [replayToken, setReplayToken] = useState(0);

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-muted-foreground text-xs uppercase tracking-eyebrow">Lab 5</p>
      <h1 className="font-heading text-title mt-2 font-semibold">
        Scroll-linked real-data reveal
      </h1>
      <p className="text-muted-foreground mt-3 max-w-[62ch] text-sm leading-relaxed">
        The real wave-7 eval figures (Warmer, Style Maitri, TriageIQ — same sourced
        values), drawing in from 0 as each scrolls into view instead of rendering
        static. Scroll down, or hit Replay.
      </p>
      <button
        type="button"
        onClick={() => setReplayToken((t) => t + 1)}
        className="text-muted-foreground hover:text-accent mt-4 text-xs underline decoration-1 underline-offset-4"
      >
        Replay
      </button>

      <div style={{ height: "70vh" }} className="flex items-end pb-6">
        <p className="text-muted-foreground text-xs">↓ scroll to trigger the first figure</p>
      </div>

      <div className="flex flex-col gap-24">
        {flagship.map((p) => (
          <div key={p.slug}>
            <h2 className="font-heading text-lead font-semibold">{p.name}</h2>
            <div className="mt-4">
              <ScrollDrawFigure figure={p.figure!} label={p.metric!.label} replayToken={replayToken} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
