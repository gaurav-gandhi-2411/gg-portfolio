"use client";

import { useId, useState } from "react";
import type { ProvenanceInfo } from "@/lib/provenance";
import { cn } from "@/lib/utils";

/**
 * Wraps a case-study metric (results/decisions/story) in a source-reveal
 * disclosure — the site's highest-signal feature: every number traces to a
 * committed file, and now that trace is one hover or tap away instead of
 * buried in content/provenance.md. Desktop mouse users get a hover preview
 * (`group-hover`, no JS state); the same `data-open` toggle also drives a
 * tap-to-pin path for touch and a real APG disclosure (button +
 * aria-expanded/aria-controls) for keyboard — same pattern as
 * components/triageiq-classify-disclosure.tsx, extended with the hover
 * layer. Opacity-only reveal transition, so it stays on under
 * prefers-reduced-motion by the same rule the project-card hover-recede
 * effect already documents (app/globals.css): opacity carries no motion,
 * only transform/translate do, and this component uses neither.
 */
export function MetricProvenance({
  info,
  label,
  children,
}: {
  info: ProvenanceInfo | null;
  /** Accessible name for the disclosure — the metric's own label, not its value. */
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  if (!info) return <>{children}</>;

  return (
    <span className="group/prov relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="decoration-muted-foreground/60 hover:decoration-accent focus-visible:outline-ring -my-2.5 inline-flex min-h-11 min-w-11 items-center rounded-sm underline decoration-dotted underline-offset-4 transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {children}
        <span className="sr-only">, show source for {label}</span>
      </button>
      <span
        id={panelId}
        role="group"
        aria-label={`Source for ${label}`}
        data-open={open}
        className={cn(
          // Mobile audit follow-up (2026-08-14): document.documentElement
          // .scrollWidth was registering ink overflow on every case-study
          // route with a "prose"-tier metric whose sourceText (or a
          // structured citation's file path) contains a long unbroken
          // token — a backtick-wrapped path/command with no spaces, most
          // commonly. Neither the panel's own position (left-0 vs.
          // centered — tried and ruled out empirically) nor its
          // max-w-[calc(100vw-3rem)] clamp caused this: the panel's own
          // box already fits within the viewport (confirmed via
          // getBoundingClientRect on every trigger on the worst-case
          // route); the overflow is the *unwrapped text itself* exceeding
          // the panel's own w-72 box internally (panel.scrollWidth was up
          // to 473px against a 288px offsetWidth), which counts toward the
          // document's ink overflow even though the panel is invisible
          // (opacity-0/pointer-events-none) while closed. break-words on
          // both text children below forces a break inside an otherwise
          // unbroken token instead of letting it run past the box —
          // fixes the true cause; see the two className additions below.
          "border-border/60 bg-popover text-popover-foreground shadow-card-hover pointer-events-none absolute left-0 top-full z-20 mt-[var(--space-2)] w-72 max-w-[calc(100vw-3rem)] rounded-lg border p-4 text-left font-sans text-caption normal-case opacity-0 transition-opacity duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]",
          "group-hover/prov:pointer-events-auto group-hover/prov:opacity-100",
          "data-[open=true]:pointer-events-auto data-[open=true]:opacity-100"
        )}
      >
        <p className="text-muted-foreground font-mono text-[11px] tracking-eyebrow uppercase">
          {info.tier === "structured" ? "Verified source" : "Cited in provenance.md"}
        </p>
        <p className="text-foreground mt-1.5 leading-relaxed break-words">{info.sourceText}</p>
        {/*
          Confidence distinction (GG, 2026-08-06): a "structured" ref comes
          straight from content/metrics.json (machine-refreshed via a
          reviewed PR, carries a real commit_sha) — its citations are exact,
          so they render as clean, clickable file links below. A "prose" ref
          only ever had the sourceText above, parsed out of provenance.md's
          free-text Source cell by this component's own regex-based parser —
          that parser's guess at which file/line it refers to is NOT
          rendered as a citation, because a wrong citation next to a real
          number is worse than no citation. GG's launch-review round three:
          no link at all for this tier either, not even to provenance.md
          itself — a hiring-facing surface with a repo-file link off every
          uncertain number reads as sending the reader to go check my work,
          which the sourceText above already states plainly enough on its
          own.
        */}
        {info.tier === "structured" && info.citations.length > 0 && (
          <ul className="mt-[var(--space-2-5)] flex flex-col gap-[var(--space-1)]">
            {info.citations.map((c) => (
              <li key={`${c.file}:${c.line ?? ""}`} className="font-mono text-[11px] break-words">
                {c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent focus-visible:outline-ring underline decoration-1 underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {c.file}
                    {c.line ? `:${c.line}` : ""} ↗
                  </a>
                ) : (
                  <span className="text-muted-foreground">
                    {c.file}
                    {c.line ? `:${c.line}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted-foreground/80 mt-[var(--space-2-5)] text-[11px]">
          {info.tier === "structured" && info.citations.some((c) => c.commitSha) && (
            <>commit {info.citations.find((c) => c.commitSha)?.commitSha?.slice(0, 7)} · </>
          )}
          {info.measuredAt ? `measured ${info.measuredAt}` : `verified against source ${info.verifiedAt}`}
        </p>
      </span>
    </span>
  );
}
