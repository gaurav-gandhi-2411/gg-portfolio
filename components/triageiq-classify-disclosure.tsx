"use client";

/**
 * The toggle button lives inside TriageIQ's card (in the horizontally-
 * scrolling work slider); the panel it controls renders in normal block
 * flow below the whole slider (components/work-slider.tsx), not inside
 * the card itself — a floating popover anchored to the card was tried
 * first and hit a real bug: `overflow-x: auto` forces the UA to compute
 * `overflow-y` as `auto` too (CSS overflow spec, not a bug in this code),
 * so anything absolutely-positioned past the scroller's own height got
 * silently clipped. This mirrors the established Warmer heat-toy annex
 * pattern instead: trigger near the relevant work item, content revealed
 * in a calm block outside the scrolling container.
 *
 * `aria-controls` ties the button to the panel it opens (APG disclosure
 * pattern) even though they're not DOM-adjacent — the panel lives outside
 * the horizontally-scrolling card, so proximity alone doesn't say "this
 * button owns that content" the way it would if they were siblings
 * (design-review finding, wave 9).
 */
export const TRIAGEIQ_PANEL_ID = "triageiq-classify-panel";

export function TriageiqClassifyToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={TRIAGEIQ_PANEL_ID}
      className="text-muted-foreground hover:text-accent border-border/40 mt-4 flex items-center gap-1.5 border-t pt-4 text-left text-xs underline decoration-1 underline-offset-4"
    >
      {open ? "Hide" : "Try"} a live illustrative classifier (not the production model)
      <span aria-hidden>{open ? "▲" : "▼"}</span>
    </button>
  );
}
