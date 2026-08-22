"use client";

import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import {
  getOpenProvenance,
  getServerOpenProvenance,
  setOpenProvenance,
  subscribeProvenance,
} from "@/lib/provenance-open-store";
import type { ProvenanceInfo } from "@/lib/provenance";
import { cn } from "@/lib/utils";

/**
 * Wraps a case-study metric (results/decisions/story) in a source-reveal
 * disclosure — the site's highest-signal feature: every number traces to a
 * committed file, and now that trace is one click or tap away instead of
 * buried in content/provenance.md. A real APG disclosure (button +
 * aria-expanded/aria-controls), same pattern as
 * components/triageiq-classify-disclosure.tsx: focus never leaves the
 * trigger, Enter/Space (native button semantics) toggle it exactly like a
 * click, no separate keyboard wiring needed.
 *
 * Production audit (2026-08-22): this used to also open on hover (desktop,
 * pure CSS `group-hover`, independent of the click-toggled `open` boolean).
 * A page with a dozen of these could then show more than one panel at
 * once — tap-pin one, then hover a neighbour — each capable of covering
 * unrelated content, and for a mouse user hovering the very trigger they
 * were about to click, hover's own reveal fired before the click handler's
 * toggle, so the click immediately closed what hover had just opened
 * (visually, nothing happened). Both traced to the same cause: two
 * independent reveal paths racing each other. `open` is now driven by a
 * single click-toggle against a shared store (lib/provenance-open-store.ts)
 * with no hover path at all: opening any one panel closes every other panel
 * in the same render, so at most one is ever visible sitewide, and there is
 * only one interaction to reason about. Opacity-only reveal transition, so
 * it stays on under prefers-reduced-motion by the same rule the
 * project-card hover-recede effect already documents (app/globals.css):
 * opacity carries no motion, only transform/translate do, and this
 * component uses neither.
 */
export function MetricProvenance({
  info,
  label,
  children,
  selfAnchor = true,
}: {
  info: ProvenanceInfo | null;
  /** Accessible name for the disclosure — the metric's own label, not its value. */
  label: string;
  children: React.ReactNode;
  /**
   * When false, this component doesn't establish its own CSS positioning
   * context for the panel — the caller must mark ITS OWN wrapping element
   * (one that contains both this trigger and anything below it, like a
   * sibling label) `relative`, so the panel opens below that whole block
   * instead of directly under the trigger. Fixes the panel landing right on
   * top of the metric's own label, which sits immediately below the value
   * in case-study-page.tsx and headline-stats.tsx alike (production audit,
   * 2026-08-22 — "positioned so it never obscures its own label").
   */
  selfAnchor?: boolean;
}) {
  const panelId = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const openId = useSyncExternalStore(
    subscribeProvenance,
    getOpenProvenance,
    getServerOpenProvenance
  );
  const open = openId === panelId;

  // A tap/click anywhere outside this trigger+panel closes it — the case-
  // results grid packs rows tightly enough that an open panel can overlap
  // the metric below it (production audit, 2026-08-22: a mobile-viewport
  // repro found an open panel's own text blocking a click on the next
  // metric's trigger). This can't make that single tap land on the covered
  // trigger — that would require not overlapping at all, a larger change —
  // but it means dismissing is never more than the same one-tap-anywhere
  // gesture, not specifically the original trigger.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent): void {
      if (getOpenProvenance() !== panelId) return;
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpenProvenance(null);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, panelId]);

  if (!info) return <>{children}</>;

  return (
    <span ref={wrapperRef} className={cn("group/prov inline-block", selfAnchor && "relative")}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenProvenance(open ? null : panelId)}
        className="focus-visible:outline-ring -my-2.5 inline-flex min-h-11 min-w-11 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {/* A plain inline span, not part of the button's own inline-flex
         * layout: text-decoration on an inline-flex box only reliably
         * underlines its first line once the content wraps across more
         * than one — exactly what happened to long "prose"-format values
         * (production audit, 2026-08-22, "the dotted provenance underline
         * on wrapped multi-line display text looks broken"). A plain
         * inline element underlines every wrapped line correctly. */}
        <span
          className={cn(
            "decoration-muted-foreground/60 underline decoration-dotted underline-offset-4 transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]",
            "group-hover/prov:decoration-accent"
          )}
        >
          {children}
        </span>
        <span className="sr-only">, show source for {label}</span>
      </button>
      <span
        id={panelId}
        role="group"
        aria-label={`Source for ${label}`}
        data-open={open}
        // A keyboard user must be able to reach a scrollable region to
        // scroll it (WCAG 2.1.1 / axe's scrollable-region-focusable,
        // production audit 2026-08-22 — the max-h/overflow-y-auto added
        // above for the panel-overlap fix made every one of these a
        // scrollable region, whether or not any given citation is long
        // enough to actually overflow it). -1 while closed: this span stays
        // in the DOM at all times (only opacity/pointer-events toggle), so
        // an unconditional 0 would add an invisible tab stop to every
        // metric on the page even when its panel is shut.
        tabIndex={open ? 0 : -1}
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
          // max-h + overflow-y-auto, gated to data-open=true only
          // (production audit, 2026-08-22): the longest sourceText entries
          // could grow tall enough to overlap the next metric down on a
          // single-column (mobile) layout, covering its trigger — capping
          // the box and scrolling long content internally bounds how far
          // any one panel can reach. Gated so a CLOSED panel is never a
          // scrollable region at all: axe's scrollable-region-focusable
          // check reads computed overflow regardless of the opacity-0/
          // pointer-events-none visual hiding below, so an unconditional
          // overflow-y-auto flagged every closed panel on every route.
          "border-border/60 bg-popover text-popover-foreground shadow-card-hover pointer-events-none absolute left-0 top-full z-20 mt-[var(--space-2)] w-72 max-w-[calc(100vw-3rem)] rounded-lg border p-4 text-left font-sans text-caption normal-case opacity-0 transition-opacity duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]",
          "data-[open=true]:pointer-events-auto data-[open=true]:opacity-100 data-[open=true]:max-h-64 data-[open=true]:overflow-y-auto"
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
