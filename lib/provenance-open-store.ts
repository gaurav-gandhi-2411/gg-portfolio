"use client";

/**
 * Cross-instance exclusivity for MetricProvenance panels (production audit,
 * 2026-08-22). A case-study page renders a dozen+ of these, and each used to
 * track its own open/closed state independently — tap-pinning one open, then
 * hovering a neighbour, left both panels visible at once, each capable of
 * covering the content (or a sibling metric's own trigger) behind it. On
 * touch devices, "sticky hover" (a tap can leave an element in a lingering
 * `:hover` state until something else is touched) made this worse: tapping
 * metric A, then metric B, could leave both panels open with no further
 * input at all.
 *
 * One shared "which panel is open" id, same module-level pub/sub shape as
 * lib/search/query-match-store.ts, fixes both paths: every instance now
 * asks this store whether IT is the open one, so opening any one panel
 * (by hover, focus, or click) closes every other panel in the same render.
 */

type Listener = () => void;

let openId: string | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const cb of listeners) cb();
}

export function setOpenProvenance(id: string | null): void {
  openId = id;
  emit();
}

export function getOpenProvenance(): string | null {
  return openId;
}

export function getServerOpenProvenance(): string | null {
  return null;
}

export function subscribeProvenance(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
