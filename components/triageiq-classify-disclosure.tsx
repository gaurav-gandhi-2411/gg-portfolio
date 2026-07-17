"use client";

import { useState } from "react";
import { TriageiqClassifyPanel } from "@/components/triageiq-classify-panel";

/**
 * Self-contained disclosure for TriageIQ's live illustrative classifier
 * (wave 11). In waves 9–10 the toggle lived inside a horizontally-scrolling
 * slider card and the panel had to render outside the scroller (overflow-x:
 * auto forces overflow-y: auto, clipping anything positioned past the
 * scroller's height) — with the slider retired for a static Work layout,
 * the panel can finally sit right where the button is, in normal block
 * flow inside the card (standard APG disclosure: button + adjacent
 * controlled region). The heavy classifier logic still costs 0 eager
 * bytes: TriageiqClassifyPanel is a next/dynamic shell and only mounts
 * after the first expand.
 */
const TRIAGEIQ_PANEL_ID = "triageiq-classify-panel";

export function TriageiqClassifyDisclosure() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={TRIAGEIQ_PANEL_ID}
        className="text-muted-foreground hover:text-accent border-border/40 mt-4 flex items-center gap-1.5 border-t pt-4 text-left text-xs underline decoration-1 underline-offset-4 transition-colors motion-reduce:transition-none"
      >
        {open ? "Hide" : "Try"} a live illustrative classifier (not the production model)
        <span aria-hidden>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div id={TRIAGEIQ_PANEL_ID} className="mt-4">
          <TriageiqClassifyPanel />
        </div>
      )}
    </div>
  );
}
