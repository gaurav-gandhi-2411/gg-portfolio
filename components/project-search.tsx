"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { keywordScore } from "@/lib/search/keyword-score";
import { publishSearchMatch, registerSearchClear } from "@/lib/search/query-match-store";
import { buildSearchableText } from "@/lib/search/searchable-text";
import { CATEGORIES, type Product } from "@/content/types";
import { cn } from "@/lib/utils";

/**
 * BL-9 — plain-language project search for /projects. Keyword/substring
 * matching only (lib/search/keyword-score.ts) against each project's
 * name/tagline/tech chips/categories — zero model, computed synchronously
 * on every keystroke.
 *
 * BL-9 round 5 removed this component's original two-tier design (a
 * client-side MiniLM semantic reranking tier, loaded on focus). Round 4
 * measured that tier's honest, cache-disabled, Slow-4G cold start at
 * 570,121 ms (~9.5 minutes) — see reports/BL-9-round4-cold-start-and-model-
 * comparison.md. Round 5 re-ran the statistics properly (Wilson 95% CIs,
 * McNemar's exact test on the 28-query eval set — see
 * reports/BL-9-round5-recall-stats.json) and found MiniLM's recall was NOT
 * statistically distinguishable from this keyword-only tier's own recall,
 * a purpose-built zero-dependency pruned static-embedding alternative, or
 * a third-party static-embedding package, at n=28 — every tier's Wilson CI
 * overlapped every other tier's. Combined with the stated decision rule
 * (a multi-minute cold start is a kill regardless of recall; among the
 * rest, ship the smallest option whose CI overlaps the best performer's),
 * this keyword-only tier is what ships: it is the smallest (zero
 * additional bytes, already on every page load) option whose recall is
 * statistically indistinguishable from every model-based alternative
 * measured. See reports/BL-9-round5-static-embedding-and-decision.md for
 * the full comparison table and the four measured alternatives.
 *
 * The `@huggingface/transformers` package itself stays in package.json —
 * /ask's server-side chatbot still uses it (lib/chatbot/embed.mjs). Only
 * THIS feature's client-side use of it is gone.
 *
 * Round 6 (GG's launch review) — round 5's "always show every project,
 * re-ranked, never filter to zero" design is gone. It was deliberate and it
 * was tested (the removed test asserted exactly this), but it does not
 * survive contact with a real person typing a real query: GG typed "red" on
 * production and reported the search "did not work". It did run, and it did
 * score correctly — "red" matches two projects, but only through substrings
 * buried in a tech-chip token ("Tiered routing") and a tagline verb
 * ("predicts"), neither visible in the rendered card. Because the panel
 * never filters, the visible result was still all 14 projects in a subtly
 * reordered list with no rendered signal that anything had matched at all —
 * indistinguishable, to a person, from the box doing nothing. The scoring
 * algorithm itself is unchanged (still the round-5 tier, still the same
 * weights); only the render now excludes zero-score results, and an
 * explicit "no projects match" message covers the zero-results case that
 * this used to render as silence.
 *
 * Round 7 (GG's launch review, again) — round 6 fixed THIS dropdown's own
 * filtering, and was verified against exactly that: the dropdown, typed
 * "tria", showed only TriageIQ. It was never checked against the grid
 * sitting directly underneath, which round 6 never touched at all —
 * ProjectFilter (the category pills + "Showing X of Y" grid) had zero
 * awareness of the search query before this round, so a correctly-narrowed
 * dropdown sat over a grid still reading the unfiltered total. See
 * lib/search/query-match-store.ts: `ranked`, already filtered to score > 0,
 * is now published so the grid can filter by the same computation.
 *
 * UI pattern: a single-focus combobox (role="combobox" on the input,
 * aria-activedescendant into a role="listbox" panel) rather than a
 * roving-tabindex grid or a full ARIA 1.2 popup with its own focus trap —
 * this codebase's existing interactive surfaces (project-filter.tsx's
 * toggle-button group, ask-panel.tsx's plain input+button form) are all
 * "simple" patterns with no comparable combobox precedent, so the simplest
 * correct option was picked: focus never leaves the input, Arrow keys move
 * a visual+aria-activedescendant highlight, Enter navigates to the
 * highlighted (or top) result, Escape clears the query. Mouse users can
 * also click any result directly.
 */

const CATEGORY_LABEL_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c.label]));

interface ScoredProduct {
  product: Product;
  score: number;
}

export function ProjectSearch({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);

  const inputId = useId();
  const listboxId = useId();

  const productsWithText = useMemo(
    () =>
      products.map((product) => ({
        product,
        text: buildSearchableText({
          name: product.name,
          tagline: product.tagline,
          techChips: product.techChips,
          categoryLabels: product.categories.map((id) => CATEGORY_LABEL_BY_ID.get(id) ?? id),
        }),
      })),
    [products]
  );

  const trimmedQuery = query.trim();

  const ranked: ScoredProduct[] = useMemo(() => {
    if (trimmedQuery.length === 0) return [];
    const scored = productsWithText
      .map(({ product, text }) => ({ product, score: keywordScore(trimmedQuery, text) }))
      .filter((s) => s.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }, [productsWithText, trimmedQuery]);

  // Round 7 (GG's launch review) — this dropdown already filters to matches
  // (round 6's fix), but the grid below it never did: ProjectSearch and
  // ProjectFilter are unrelated siblings under /projects's Server Component
  // page, so typing "tria" correctly narrowed THIS panel to TriageIQ while
  // the grid still read "Showing 14 of 14" underneath it — indistinguishable
  // from search doing nothing to anyone not staring at the dropdown alone.
  // `ranked` (already score > 0, the same computation the dropdown itself
  // trusts) is the single source of truth published to the grid; see
  // lib/search/query-match-store.ts for why this is a module-level store
  // rather than lifted React state.
  useEffect(() => {
    publishSearchMatch(
      trimmedQuery.length === 0 ? null : new Set(ranked.map((r) => r.product.slug))
    );
  }, [trimmedQuery, ranked]);

  // Registered once, not per-keystroke: lets the grid's zero-results empty
  // state clear the actual search box, not just its own filtered view of it.
  useEffect(() => {
    registerSearchClear(() => {
      setQuery("");
      setOpen(false);
      setActiveIndex(-1);
    });
    return () => {
      registerSearchClear(null);
      publishSearchMatch(null);
    };
  }, []);

  function handleFocus(): void {
    if (trimmedQuery.length > 0) setOpen(true);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    setQuery(e.target.value);
    setActiveIndex(-1);
    setOpen(e.target.value.trim().length > 0);
  }

  function handleBlur(): void {
    // Deferred so a click landing on a result link (inside containerRef)
    // is processed before the panel unmounts out from under it.
    window.setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setOpen(false);
      }
    }, 0);
  }

  const router = useRouter();

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (!open || ranked.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % ranked.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? ranked.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = ranked[activeIndex >= 0 ? activeIndex : 0];
      setOpen(false);
      router.push(`/work/${target.product.slug}`);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery("");
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const activeOptionId =
    open && activeIndex >= 0 && ranked[activeIndex] ? `${listboxId}-${ranked[activeIndex].product.slug}` : undefined;

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-xl">
      <label htmlFor={inputId} className="sr-only">
        Search projects by what they do
      </label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Try: reduces on-call issue triage time"
        className="border-border bg-card text-foreground focus-visible:ring-ring/50 focus-visible:border-ring w-full rounded-md border px-3.5 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2"
      />

      {open && trimmedQuery.length > 0 && ranked.length === 0 ? (
        // Same id as the listbox below so aria-controls always resolves to
        // whichever of the two is actually on screen. Not role="listbox"
        // itself — an empty listbox with no role="option" children fails
        // axe's aria-required-children check, and there is nothing here to
        // select anyway.
        <p
          id={listboxId}
          role="status"
          className="border-border/60 bg-popover text-popover-foreground shadow-card-hover absolute top-full left-0 z-20 mt-2 w-full rounded-lg border p-3 text-sm text-muted-foreground"
        >
          No projects match &ldquo;{trimmedQuery}&rdquo;.
        </p>
      ) : null}

      {open && ranked.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Project search results, ranked by relevance"
          className="message-in border-border/60 bg-popover text-popover-foreground shadow-card-hover absolute top-full left-0 z-20 mt-2 max-h-[28rem] w-full overflow-y-auto rounded-lg border p-2"
        >
          {ranked.map((r, i) => (
            // No nested <a> here on purpose — axe's no-focusable-content
            // rule correctly flags ANY focusable descendant inside
            // role="option" (even tabIndex={-1}) as unreachable-but-not-
            // really for assistive tech browse mode. The ARIA APG combobox
            // pattern keeps focus on the input throughout (see this
            // component's header) and options are inert containers whose
            // only affordance is a click handler — activation is Enter (via
            // handleKeyDown) or a direct click, both driving the same
            // router.push, never a real navigable link.
            <li
              key={r.product.slug}
              id={`${listboxId}-${r.product.slug}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => {
                setOpen(false);
                router.push(`/work/${r.product.slug}`);
              }}
              className={cn(
                "cursor-pointer rounded-md px-3 py-2 transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] motion-reduce:transition-none",
                i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-secondary"
              )}
            >
              <span className="block text-sm font-medium">{r.product.name}</span>
              <span
                className={cn(
                  "block text-caption leading-snug",
                  i === activeIndex ? "text-accent-foreground/85" : "text-muted-foreground"
                )}
              >
                {r.product.tagline}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
