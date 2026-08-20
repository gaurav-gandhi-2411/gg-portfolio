"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";

import { ItemResults } from "@/components/mmfr/item-results";
import { ItemScatter } from "@/components/mmfr/item-scatter";
import { emphasisFor, type MmfrProjection } from "@/lib/mmfr-projection-view";
import { mayUseWebGL } from "@/lib/webgl/capability";
import projectionJson from "@/content/data/mmfr-projection.json";

/**
 * Imported here rather than passed as a prop, for the same reason the
 * TriageIQ retrieval space does it: 500 points passed down from the server
 * would serialize the whole ~34 KB projection into the RSC payload of every
 * visitor to this route, including the ones who never open this section.
 * Importing it inside this dynamically-loaded module puts it in the lazy
 * chunk instead.
 */
const projection = projectionJson as MmfrProjection;

const ItemSpaceGL = dynamic(() => import("./item-space-gl"), {
  ssr: false,
  loading: () => null,
});

/**
 * The interactive half of the MMFR item-space explainer.
 *
 * What a visitor is looking at: 500 real items from one brand's live
 * catalogue, fused by the same trained item tower production uses and laid
 * out by t-SNE. Pick an anchor and the five items the model's own space
 * actually returned for it light up, with whether each shares the anchor's
 * real category.
 *
 * The picture is a layout and the ranking is not computed in it. That gap is
 * the thing most likely to mislead a reader here, so it is stated in the copy
 * beside the canvas rather than left for anyone to work out, and the
 * highlight is driven by product id rather than by screen proximity, so
 * nothing on screen is ever evidence for a claim the numbers do not make.
 */
export default function ItemSpaceClient() {
  const [selected, setSelected] = useState(0);
  // Decided once, in a lazy initialiser rather than an effect. This module is
  // dynamically imported with ssr:false, so there is no server render for a
  // capability read to disagree with, and doing it here means a qualifying
  // visitor never sees the SVG paint and then get replaced by a canvas.
  const [useGL, setUseGL] = useState(() => mayUseWebGL());

  const anchor = projection.anchors[selected];
  const emphasis = useMemo(
    () => emphasisFor(projection.points, anchor),
    [anchor]
  );

  const handleUnsupported = useCallback(() => setUseGL(false), []);

  return (
    <div className="flex flex-col gap-[var(--space-5)]">
      <div className="flex flex-wrap gap-[var(--space-2)]" role="group" aria-label="Pick an item">
        {projection.anchors.map((candidate, i) => (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={i === selected}
            onClick={() => setSelected(i)}
            className={`border-border/40 min-h-11 rounded-md border px-[var(--space-3)] py-[var(--space-2)] font-mono text-caption transition-colors motion-reduce:transition-none ${
              i === selected
                ? "bg-accent/15 border-accent/50 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {candidate.category}
          </button>
        ))}
      </div>

      <div className="grid gap-[var(--space-6)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="border-border/40 relative aspect-square overflow-hidden rounded-lg border">
          {useGL ? (
            <ItemSpaceGL
              points={projection.points}
              emphasis={emphasis}
              onUnsupported={handleUnsupported}
            />
          ) : (
            <ItemScatter points={projection.points} emphasis={emphasis} />
          )}
        </div>

        <div className="flex flex-col gap-[var(--space-3)]">
          {/*
            aria-live rather than a heading change: picking an anchor swaps
            the whole panel, and a screen reader user who activated a button
            needs to be told what came back without having to go looking
            for it.
          */}
          <div aria-live="polite">
            <ItemResults anchor={anchor} />
          </div>
        </div>
      </div>
    </div>
  );
}
