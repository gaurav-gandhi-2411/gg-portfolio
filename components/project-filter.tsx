"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import { CATEGORIES, type CategoryId } from "@/content/types";

type Active = CategoryId | "all";

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((c) => c.id));
const TEASE_LIMIT = 4;

function readCategoryFromUrl(): Active {
  const param = new URLSearchParams(window.location.search).get("category");
  return param && CATEGORY_IDS.has(param) ? (param as CategoryId) : "all";
}

/**
 * The active category lives in the URL, read via useSyncExternalStore:
 * popstate re-reads it for back/forward, `emit` re-reads it after our own
 * replaceState (which fires no event), and the server snapshot is "all" —
 * matching the prerendered HTML, so a deep-linked ?category= applies at
 * hydration with no mismatch.
 */
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("popstate", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}
function emit() {
  for (const cb of listeners) cb();
}

/**
 * Wave 13 — category filter for the Work section and /projects.
 *
 * Design notes, all deliberate:
 * - The project cards are SERVER-rendered and passed through as `children`;
 *   filtering happens in CSS (`[data-active-category]` rules in
 *   globals.css) against each card's `data-cats` attribute. Clicking a
 *   pill changes one data attribute — no card re-renders, no server round
 *   trip, instant at any project count.
 * - URL-reflected via history.replaceState (?category=…), so a filtered
 *   view is shareable and back/forward keeps working (popstate listener).
 *   Deliberately NOT useSearchParams: on a static route that would drop
 *   the whole subtree (all cards) from the prerendered HTML behind a
 *   Suspense boundary — losing SSR/no-JS content for a query param read.
 * - Initial state is always "all" (matches the server HTML, no hydration
 *   mismatch); a deep-linked ?category= applies right after hydration.
 * - No-JS: every card stays visible and the pills are inert — filtering
 *   is an enhancement, never a gate on content.
 * - Buttons with aria-pressed (single-select toggle group), visible focus
 *   ring, result count announced politely for screen readers.
 *
 * Wave 15 — progressive disclosure: any active view beyond TEASE_LIMIT
 * matching cards caps to the first 4 (in content/products.ts order) with a
 * "See all N" link to the dedicated destination (/projects for "All" on
 * home, /projects/[category] otherwise). The cap is pure CSS keyed off the
 * same data-active-category attribute the existing filter already uses, so
 * it never costs extra client JS. A no-JS visitor's data-active-category is
 * always "all" (see the module comment above) — for THAT case specifically,
 * capping would become a permanent content gate instead of a tease, so a
 * <noscript> override restores full visibility whenever scripting is off.
 */
export function ProjectFilter({
  cats,
  children,
  capAllAt4 = false,
}: {
  /** slug → category ids, in display order — used only for counts. */
  cats: { slug: string; categories: readonly string[] }[];
  children: React.ReactNode;
  /**
   * Cap the "All" view to a 4-card tease + "See all N →" to /projects.
   * Used on home; /projects itself is the see-all destination so its own
   * "All" view stays uncapped. Category filters always cap regardless (their
   * own see-all destination is /projects/[category]).
   */
  capAllAt4?: boolean;
}) {
  const active = useSyncExternalStore(subscribe, readCategoryFromUrl, () => "all" as Active);

  function select(next: Active) {
    const url = new URL(window.location.href);
    if (next === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", next);
    window.history.replaceState(null, "", url);
    emit();
  }

  const counts = useMemo(() => {
    const byCat = new Map<string, number>();
    for (const c of CATEGORIES) {
      byCat.set(c.id, cats.filter((p) => p.categories.includes(c.id)).length);
    }
    return byCat;
  }, [cats]);

  const orderedForActive = useMemo(
    () => (active === "all" ? cats : cats.filter((p) => p.categories.includes(active))),
    [cats, active],
  );
  const totalMatching = orderedForActive.length;
  const isCapped = active === "all" ? capAllAt4 : true;
  const displayedCount = isCapped ? Math.min(TEASE_LIMIT, totalMatching) : totalMatching;
  const overflowSlugs = isCapped ? orderedForActive.slice(TEASE_LIMIT).map((p) => p.slug) : [];
  const showSeeAll = overflowSlugs.length > 0;
  const seeAllHref = active === "all" ? "/projects" : `/projects/${active}`;
  const seeAllLabel =
    active === "all"
      ? `See all ${totalMatching} →`
      : `See all ${totalMatching} in ${CATEGORIES.find((c) => c.id === active)?.label ?? ""} →`;
/*
 * The -my-[5px] keeps a 44px tap target from bulking out the row visually.
 * It also makes each pill's box overlap its neighbours' by 5px top and
 * bottom, which is invisible on one line and a real bug the moment the row
 * wraps: with only 8px of row gap, pills in adjacent rows overlapped by 2px
 * and one could swallow a tap meant for the other. Chromium hit-tests the
 * overlap to whichever pill paints last, so on a phone the wrong filter
 * could apply. The row gap is now wide enough that the negative margins
 * cannot close it. Found because Playwright kept retrying a click and
 * reporting that another pill "intercepts pointer events", which was the
 * harness describing the bug accurately rather than being flaky.
 */

  // gap-1, not a relied-on JSX text-node space before the count span: a
  // flex container (this button is inline-flex, for vertical centering)
  // wraps each contiguous run of text in its own anonymous flex item, and
  // whitespace sitting at the boundary between two flex items collapses
  // away instead of rendering — "All " + <span>14</span> becomes "All14"
  // on screen even though the source has a literal space between them.
  // The count spans below rely on this gap rather than on incidental
  // whitespace surviving flex layout.
  const pillBase =
    "focus-visible:outline-ring -my-[5px] inline-flex min-h-11 items-center gap-1 rounded-full border px-3.5 py-[var(--space-1-5)] text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none active:scale-95 motion-reduce:active:scale-100";
  // Wave 14 fix: a solid fill, not a 15%-tint border — GG reported clicking
  // a pill and "nothing happens." The mechanism was firing correctly (the
  // bug hunt is in reports/wave14-…); the actual defect was that success
  // and failure looked identical: the only confirmation text was sr-only
  // (see the visible counter below) and the selected state was a nearly
  // imperceptible tint. Solid accent fill + accent-foreground text is the
  // same "you are here" contrast the nav's active-page state already uses.
  const pillOn = "border-accent bg-accent text-accent-foreground";
  // Full-opacity border: on an unselected pill the border is the ONLY
  // boundary affordance, so WCAG 1.4.11's 3:1 applies — --border at 100%
  // is 3.38:1; at the /40 first cut it computed ~1.47:1, the exact value
  // the token was raised to escape (design-review finding 2).
  const pillOff =
    "border-border text-muted-foreground hover:border-accent/70 hover:text-foreground";

  return (
    <div>
      {/* Left-aligned wrap below sm: centered ragged pill rows read as a
          cloud on a 390px screen (design-review finding 4). */}
      <div
        role="group"
        aria-label="Filter projects by category"
        className="flex flex-wrap justify-start gap-x-[var(--space-2)] gap-y-[var(--space-4)] sm:justify-center"
      >
        <button
          type="button"
          aria-pressed={active === "all"}
          onClick={() => select("all")}
          className={`${pillBase} ${active === "all" ? pillOn : pillOff}`}
        >
          {/* No opacity dim on the count: text-muted-foreground alone is
              6.57:1 (safe), but at opacity-70 (the original wave-13 value)
              it composites to 3.74:1 — under the 4.5:1 text floor. Axe
              only auto-fails this as a definite violation once the badge
              text is 2+ digits ("12"); single-digit counts get filed as
              "incomplete" (a genuine axe confidence heuristic for very
              short text, not a pass) — real math fails either width, so
              the dim comes off entirely rather than being patched around
              per-badge (wave 14, caught once this suite actually clicked
              a filter into the state where "All 12" goes inactive). */}
          All <span className="font-mono text-caption">{cats.length}</span>
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={active === c.id}
            onClick={() => select(c.id)}
            className={`${pillBase} ${active === c.id ? pillOn : pillOff}`}
          >
            {c.label} <span className="font-mono text-caption">{counts.get(c.id)}</span>
          </button>
        ))}
      </div>

      {/* Wave 14 fix: was sr-only — the ONE piece of text confirming a
          filter applied was invisible to sighted users. For any category
          that still includes the top-of-viewport card, that left zero
          perceivable feedback: a working filter and a dead click looked
          identical. Now visible, still aria-live for screen readers.
          Wave 15: denominator is now the active view's own total (more
          informative once a view can be capped — "4 of 6" beats "4 of 13"
          at telling you how much more there is to see in THIS category). */}
      <p aria-live="polite" className="text-muted-foreground mt-[var(--space-4)] text-center font-mono text-caption">
        Showing {displayedCount} of {totalMatching} projects
      </p>

      {overflowSlugs.length > 0 && (
        <>
          <style>
            {overflowSlugs
              .map(
                (slug) => `[data-active-category="${active}"] [data-slug="${slug}"]{display:none}`,
              )
              .join("")}
          </style>
          {/* Progressive tease, never a content gate: a no-JS visitor can
              never click "See all" or change the category, so restore
              every card for them. display:flex mirrors ProjectCard's own
              article className. */}
          <noscript>
            <style>{`[data-active-category="${active}"] [data-slug]{display:flex!important}`}</style>
          </noscript>
        </>
      )}

      <div data-active-category={active}>{children}</div>

      {showSeeAll && (
        <p className="mt-[var(--space-6)] text-center">
          <Link
            href={seeAllHref}
            className="text-accent focus-visible:outline-ring -my-3 inline-flex min-h-11 items-center text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            {seeAllLabel}
          </Link>
        </p>
      )}

      {totalMatching === 0 && (
        <div className="border-border/40 bg-card/40 mt-[var(--space-8)] rounded-xl border px-[var(--space-6)] py-10 text-center">
          <p className="text-foreground">Nothing in this category yet.</p>
          <button
            type="button"
            onClick={() => select("all")}
            className="text-accent focus-visible:outline-ring mt-[var(--space-2)] text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            Show all projects
          </button>
        </div>
      )}
    </div>
  );
}
