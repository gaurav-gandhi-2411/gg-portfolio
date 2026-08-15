"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { keywordScore } from "@/lib/search/keyword-score";
import { buildSearchableText } from "@/lib/search/searchable-text";
import { CATEGORIES, type Product } from "@/content/types";
import { cn } from "@/lib/utils";

/**
 * BL-9 — plain-language project search for /projects. Two tiers, always in
 * this order:
 *
 *   1. Keyword/substring matching (lib/search/keyword-score.ts) against each
 *      project's name/tagline/tech chips/categories — zero model, computed
 *      synchronously on every keystroke, and the ONLY thing this component
 *      depends on to be useful. This is what every visitor gets by default,
 *      including anyone who never focuses the input, anyone on a slow
 *      connection, and anyone whose JS partially fails — see Tier 2 below,
 *      which degrades to exactly this with no user-facing error.
 *
 *   2. Semantic reranking, loaded ONLY on focus/first keystroke (never on
 *      page load — see lib/search/embed-client.ts's header for why this
 *      runs client-side, unlike the /ask chatbot's server-side embedding).
 *      Both the client-side embedding module and the precomputed
 *      content/search/project-embeddings.json vector file are pulled in via
 *      `await import()` inside the interaction handlers below, never a
 *      top-level import — that is what keeps them out of this route's
 *      initial JS and off the network until a visitor actually interacts
 *      with the box (verified with a captured network log, see the PR
 *      description).
 *
 * All 13 projects are always shown, re-ranked — this box ranks, it never
 * filters to zero, so there is no "no results" state to design for (the
 * closed panel — no query typed yet — is this component's actual empty
 * state; see the render below).
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

const DENSE_WEIGHT = 0.6;
const DEBOUNCE_MS = 250;

const CATEGORY_LABEL_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c.label]));

type EnhancedStatus = "idle" | "loading" | "ready" | "unavailable";

interface ScoredProduct {
  product: Product;
  score: number;
}

export function ProjectSearch({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [enhanced, setEnhanced] = useState<EnhancedStatus>("idle");
  const [denseScores, setDenseScores] = useState<Record<string, number> | null>(null);
  const [denseScoresFor, setDenseScoresFor] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const embeddingsRef = useRef<Map<string, number[]> | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const embedTokenRef = useRef(0);

  const inputId = useId();
  const listboxId = useId();
  const statusId = useId();

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
    const useDense = denseScores !== null && denseScoresFor === trimmedQuery;
    const scored = productsWithText.map(({ product, text }) => {
      const kw = keywordScore(trimmedQuery, text);
      if (!useDense) return { product, score: kw };
      const dense = denseScores![product.slug] ?? 0;
      return { product, score: DENSE_WEIGHT * dense + (1 - DENSE_WEIGHT) * kw };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }, [productsWithText, trimmedQuery, denseScores, denseScoresFor]);

  // Stable across renders (useCallback, empty deps — everything it reads is
  // a ref or a setState setter, both stable identities) so the effect below
  // can list it as a real dependency instead of an eslint-disabled one.
  const runEmbedding = useCallback(async (text: string): Promise<void> => {
    const token = ++embedTokenRef.current;
    try {
      const { embedQuery, cosineSimilarity } = await import("@/lib/search/embed-client");
      const vector = await embedQuery(text);
      if (token !== embedTokenRef.current || !embeddingsRef.current) return; // superseded or unloaded
      const scores: Record<string, number> = {};
      for (const [slug, embedding] of embeddingsRef.current) {
        scores[slug] = cosineSimilarity(vector, embedding);
      }
      setDenseScores(scores);
      setDenseScoresFor(text);
    } catch {
      // A query embed failing (e.g. the model unloaded mid-session) leaves
      // the keyword tier as the ranking — no user-facing error, matching
      // the load-failure path below.
    }
  }, []);

  // Re-embed the query (debounced) whenever it changes and the enhanced
  // tier is ready — a fresh embedTokenRef value guards against a slow
  // in-flight embed() call resolving after a NEWER query has already
  // superseded it (stale-result race, not just a UI nicety: without this a
  // fast typist could see results ranked for a query two keystrokes old).
  useEffect(() => {
    if (enhanced !== "ready" || trimmedQuery.length === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runEmbedding(trimmedQuery);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmedQuery, enhanced, runEmbedding]);

  /** Starts the tier-2 load on first focus/keystroke — guarded so it only
   * ever runs once per mount, per the "focuses or types" trigger. */
  function ensureEnhancedLoading(): void {
    if (enhanced !== "idle") return;
    setEnhanced("loading");
    void (async () => {
      try {
        const [{ preloadExtractor }, embeddingsModule] = await Promise.all([
          import("@/lib/search/embed-client"),
          import("@/content/search/project-embeddings.json"),
        ]);
        await preloadExtractor();
        const data = embeddingsModule.default as {
          projects: { slug: string; embedding: number[] }[];
        };
        embeddingsRef.current = new Map(data.projects.map((p) => [p.slug, p.embedding]));
        setEnhanced("ready");
      } catch {
        // Optional dependency absent, model fetch blocked/failed, or the
        // embeddings JSON failed to load — the keyword tier already covers
        // every visitor, so this degrades silently rather than erroring.
        setEnhanced("unavailable");
      }
    })();
  }

  function handleFocus(): void {
    ensureEnhancedLoading();
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
    <div
      ref={containerRef}
      // data-search-enhanced-status: no visual/behavioral effect, read only
      // by e2e/perf tooling (see e2e/project-search-cold-start.spec.ts) that
      // needs to observe "tier-2 model loaded" and "dense scores applied for
      // the current query" without guessing from a fixed sleep — the same
      // reasoning that motivated data-testid="project-search-unavailable"
      // below, generalized to the other two enhanced states.
      data-search-enhanced-status={enhanced}
      data-search-dense-scores-for={denseScoresFor ?? undefined}
      className="relative mx-auto w-full max-w-xl"
    >
      <label htmlFor={inputId} className="sr-only">
        Search projects by what they do
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-describedby={enhanced === "loading" || enhanced === "unavailable" ? statusId : undefined}
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

      {enhanced === "loading" ? (
        <p id={statusId} role="status" className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
          <span aria-hidden="true" className="flex items-center gap-1">
            <span className="typing-dot bg-muted-foreground inline-block h-1 w-1 rounded-full" />
            <span className="typing-dot bg-muted-foreground inline-block h-1 w-1 rounded-full" />
            <span className="typing-dot bg-muted-foreground inline-block h-1 w-1 rounded-full" />
          </span>
          Loading smarter ranking…
        </p>
      ) : null}
      {enhanced === "unavailable" ? (
        <p
          id={statusId}
          role="status"
          data-testid="project-search-unavailable"
          className="text-muted-foreground mt-2 text-xs"
        >
          Smarter ranking unavailable — showing keyword matches.
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
                "cursor-pointer rounded-md px-3 py-2 transition-colors motion-reduce:transition-none",
                i === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-secondary"
              )}
            >
              <span className="block text-sm font-medium">{r.product.name}</span>
              <span
                className={cn(
                  "block text-xs leading-snug",
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
