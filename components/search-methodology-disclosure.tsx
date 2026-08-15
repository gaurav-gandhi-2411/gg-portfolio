"use client";

import { useState } from "react";

/**
 * Generic button+state disclosure — same APG pattern (button + adjacent
 * aria-controls'd region) as components/triageiq-classify-disclosure.tsx,
 * generalized to take arbitrary server-rendered children instead of one
 * hardcoded panel. The provenance lookups the panel's content needs
 * (getProvenance, node:fs-backed) only run server-side, so this component
 * stays a thin client-only open/close shell: components/search-methodology.tsx
 * fetches the data and builds the JSX tree server-side, then hands it to
 * this component as `children` — a normal RSC "server component renders a
 * client component" boundary, not a client-side data fetch.
 */
export function SearchMethodologyDisclosure({
  summary,
  panelId,
  children,
}: {
  summary: string;
  panelId: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-border/40 mt-6 border-t pt-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="text-muted-foreground hover:text-accent focus-visible:outline-ring -mx-2 -my-2.5 flex min-h-11 items-center gap-1.5 rounded-sm px-2 text-left text-xs underline decoration-1 underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
      >
        {summary}
        <span aria-hidden>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div id={panelId} className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
}
