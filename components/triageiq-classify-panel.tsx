"use client";

import dynamic from "next/dynamic";

/**
 * Lazy shell — same pattern as heat-toy-shell.tsx. The classifier's logic
 * and 12-item sample corpus cost 0 eager bytes until a visitor actually
 * expands it (components/work-slider.tsx renders this only when
 * showClassifier is true, which itself only mounts after a click).
 */
export const TriageiqClassifyPanel = dynamic(
  () => import("./triageiq-classify-toy").then((m) => m.TriageiqClassifyToy),
  { loading: () => <p className="text-muted-foreground text-xs">Loading…</p> }
);
