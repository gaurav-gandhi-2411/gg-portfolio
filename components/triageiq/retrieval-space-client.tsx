"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";

import { RetrievalResults } from "@/components/triageiq/retrieval-results";
import { RetrievalScatter } from "@/components/triageiq/retrieval-scatter";
import { emphasisFor, type RetrievalProjection } from "@/lib/triageiq-retrieval-view";
import { mayUseWebGL } from "@/lib/webgl/capability";
import projectionJson from "@/content/data/triageiq-retrieval-projection.json";

/**
 * Imported here rather than passed as a prop, for the same reason the Warmer
 * viewer does it: 700 points passed down from the server would serialize the
 * whole 38 KB projection into the RSC payload of every visitor to this route,
 * including the ones who never open this section. Importing it inside this
 * dynamically-loaded module puts it in the lazy chunk instead.
 */
const projection = projectionJson as RetrievalProjection;

const RetrievalSpaceGL = dynamic(() => import("./retrieval-space-gl"), {
  ssr: false,
  loading: () => null,
});

/**
 * The interactive half of the retrieval-space explainer.
 *
 * What a visitor is looking at: 700 real kubernetes issues from TriageIQ's own
 * gold set, embedded by the same model production uses and laid out by t-SNE.
 * Pick a query and the five issues the retriever actually returned light up,
 * with the one the gold set calls related marked wherever it landed.
 *
 * The picture is a layout and the ranking is not computed in it. That gap is
 * the thing most likely to mislead a reader here, so it is stated in the copy
 * beside the canvas rather than left for anyone to work out, and the
 * highlight is driven by issue number rather than by screen proximity, so
 * nothing on screen is ever evidence for a claim the numbers do not make.
 */
export default function RetrievalSpaceClient() {
  const [selected, setSelected] = useState(0);
  // Decided once, in a lazy initialiser rather than an effect. This module is
  // dynamically imported with ssr:false, so there is no server render for a
  // capability read to disagree with, and doing it here means a qualifying
  // visitor never sees the SVG paint and then get replaced by a canvas.
  const [useGL, setUseGL] = useState(() => mayUseWebGL());

  const query = projection.queries[selected];
  const emphasis = useMemo(
    () => emphasisFor(projection.points, query),
    [query]
  );

  const handleUnsupported = useCallback(() => setUseGL(false), []);

  return (
    <div className="flex flex-col gap-[var(--space-5)]">
      <div className="flex flex-wrap gap-[var(--space-2)]" role="group" aria-label="Pick an issue">
        {projection.queries.map((candidate, i) => (
          <button
            key={candidate.n}
            type="button"
            aria-pressed={i === selected}
            onClick={() => setSelected(i)}
            className={`border-border/40 min-h-11 rounded-md border px-[var(--space-3)] py-[var(--space-2)] font-mono text-caption transition-colors motion-reduce:transition-none ${
              i === selected
                ? "bg-accent/15 border-accent/50 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            #{candidate.n}
          </button>
        ))}
      </div>

      <div className="grid gap-[var(--space-6)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="border-border/40 relative aspect-square overflow-hidden rounded-lg border">
          {useGL ? (
            <RetrievalSpaceGL
              points={projection.points}
              emphasis={emphasis}
              onUnsupported={handleUnsupported}
            />
          ) : (
            <RetrievalScatter points={projection.points} emphasis={emphasis} />
          )}
        </div>

        <div className="flex flex-col gap-[var(--space-3)]">
          {/*
            aria-live rather than a heading change: picking a query swaps the
            whole panel, and a screen reader user who activated a button needs
            to be told what came back without having to go looking for it.
          */}
          <div aria-live="polite">
            <RetrievalResults query={query} topK={projection.top_k} />
          </div>
        </div>
      </div>
    </div>
  );
}
