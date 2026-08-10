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
        className="decoration-muted-foreground/60 hover:decoration-accent focus-visible:outline-ring -my-2.5 inline-flex min-h-11 min-w-11 items-center rounded-sm underline decoration-dotted underline-offset-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {children}
        <span className="sr-only"> — show source for {label}</span>
      </button>
      <span
        id={panelId}
        role="group"
        aria-label={`Source for ${label}`}
        data-open={open}
        className={cn(
          "border-border/60 bg-popover text-popover-foreground shadow-card-hover pointer-events-none absolute left-0 top-full z-20 mt-2 w-72 max-w-[calc(100vw-3rem)] rounded-lg border p-4 text-left font-sans text-xs normal-case opacity-0 transition-opacity duration-150 ease-out",
          "group-hover/prov:pointer-events-auto group-hover/prov:opacity-100",
          "data-[open=true]:pointer-events-auto data-[open=true]:opacity-100"
        )}
      >
        <p className="text-muted-foreground font-mono text-[11px] tracking-eyebrow uppercase">
          {info.tier === "structured" ? "Verified source" : "Cited in provenance.md"}
        </p>
        <p className="text-foreground mt-1.5 leading-relaxed">{info.sourceText}</p>
        {/*
          Confidence distinction (GG, 2026-08-06): a "structured" ref comes
          straight from content/metrics.json (machine-refreshed via a
          reviewed PR, carries a real commit_sha) — its citations are exact,
          so they render as clean, clickable file links below. A "prose"
          ref only ever had the sourceText above, parsed out of
          provenance.md's free-text Source cell by this component's own
          regex-based parser — that parser's guess at which file/line it
          refers to is NOT rendered as a citation, because a wrong citation
          next to a real number is worse than no citation. The only link
          offered for that tier goes to provenance.md itself, never to a
          file this parser picked out of its prose.
        */}
        {info.tier === "structured" && info.citations.length > 0 && (
          <ul className="mt-2.5 flex flex-col gap-1">
            {info.citations.map((c) => (
              <li key={`${c.file}:${c.line ?? ""}`} className="font-mono text-[11px]">
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
        {info.tier === "prose" && info.provenanceDocUrl && (
          <a
            href={info.provenanceDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent focus-visible:outline-ring mt-2.5 inline-block font-mono text-[11px] underline decoration-1 underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            View in content/provenance.md ↗
          </a>
        )}
        <p className="text-muted-foreground/80 mt-2.5 text-[11px]">
          {info.tier === "structured" && info.citations.some((c) => c.commitSha) && (
            <>commit {info.citations.find((c) => c.commitSha)?.commitSha?.slice(0, 7)} · </>
          )}
          {info.measuredAt ? `measured ${info.measuredAt}` : `verified against source ${info.verifiedAt}`}
        </p>
      </span>
    </span>
  );
}
