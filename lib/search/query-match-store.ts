"use client";

/**
 * GG's launch-review round three: "Fix it so typing narrows the grid."
 * ProjectSearch (the /projects combobox) and ProjectFilter (the grid's
 * category pills, and the grid itself) are separate components with no
 * shared state — ProjectSearch ranks and offers a jump-to dropdown, per
 * its own header's documented design, but nothing ever told the grid what
 * the query matched. This is that missing connection: a tiny module-level
 * pub/sub, the same shape ProjectFilter already uses for its own
 * listeners/emit() category-sync, so the grid can filter by the SAME
 * keywordScore computation the dropdown already ranks with — one source
 * of truth, not two scoring paths that could disagree.
 *
 * `matchingSlugs` is null when no query is active (ProjectFilter then
 * filters by category alone, exactly as before) or a set of slugs whose
 * keyword score is > 0 (ProjectFilter intersects its category-filtered
 * list against this set). Module-level, not component state, because
 * ProjectSearch and ProjectFilter are unrelated siblings under a Server
 * Component page — cleared on ProjectSearch's unmount so a client-side
 * nav away from /projects can't leave a stale filter for whatever page
 * mounts a ProjectFilter next (home's Work section does, capped).
 */

type Listener = () => void;

let matchingSlugs: ReadonlySet<string> | null = null;
let clearQueryFn: (() => void) | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const cb of listeners) cb();
}

export function publishSearchMatch(slugs: ReadonlySet<string> | null): void {
  matchingSlugs = slugs;
  emit();
}

export function getSearchMatch(): ReadonlySet<string> | null {
  return matchingSlugs;
}

export function getServerSearchMatch(): ReadonlySet<string> | null {
  return null;
}

export function subscribeSearchMatch(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** ProjectSearch registers how to clear its own input once, on mount, so
 * ProjectFilter's zero-results empty state can clear the actual search
 * box rather than only its own filtered view of it. */
export function registerSearchClear(fn: (() => void) | null): void {
  clearQueryFn = fn;
}

export function clearSearch(): void {
  clearQueryFn?.();
}
