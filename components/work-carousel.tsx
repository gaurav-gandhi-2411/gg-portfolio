"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { GithubIcon } from "@/components/icons/brand-icons";
import { cn } from "@/lib/utils";
import type { Product } from "@/content/types";

export interface CarouselSlide {
  product: Product;
  dateline?: string;
}

/**
 * Horizontal product carousel (wave 5). Native scroll + CSS scroll-snap does
 * the sliding — touch and trackpad work with zero JS — with a thin client
 * shell for arrow buttons, slide-wise keyboard steps, and the position
 * counter. A11y contract (the wave's audit risk, so spelled out):
 *   - wrapper: role="region" + aria-roledescription="carousel", labelled
 *   - each slide: role="group" + aria-roledescription="slide" +
 *     "N of M: name" label
 *   - scroller is a focusable, labelled element; ArrowLeft/ArrowRight move
 *     exactly one slide (native arrow-key scrolling would move by pixels)
 *   - no aria-hidden/display:none on off-screen slides — links inside them
 *     stay tabbable and the browser scrolls them into view on focus
 *   - smooth scrolling collapses to instant under prefers-reduced-motion
 */
export function WorkCarousel({ slides }: { slides: CarouselSlide[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Where stepping is headed. Arrows/keys step from this, never from the
  // rendered index — mid-animation the visual index lags the intent, and
  // stepping from a stale index skips or repeats slides under fast input.
  const targetRef = useRef(0);
  // True while a scrollToSlide animation owns the scroll position; free
  // (touch/trackpad) scrolling must resync targetRef, animations must not.
  const animatingRef = useRef(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    // Track which slide owns the viewport by scroll position (nearest slide
    // start to scrollLeft), so the counter and the arrows' disabled states
    // stay honest while the visitor swipes/scrolls freely. Deliberately not
    // an IntersectionObserver: with card-width slides, two slides can clear
    // any visibility threshold at once and the "current" pick becomes
    // ambiguous — nearest-snap-offset never is. A trailing debounce syncs
    // the step target to wherever a free swipe actually landed.
    let frame = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    function nearestIndex(): number {
      const base = scroller!.getBoundingClientRect().left;
      let nearest = 0;
      let bestDist = Infinity;
      Array.from(scroller!.children).forEach((el, i) => {
        const offset = el.getBoundingClientRect().left - base + scroller!.scrollLeft;
        const dist = Math.abs(offset - scroller!.scrollLeft);
        if (dist < bestDist) {
          bestDist = dist;
          nearest = i;
        }
      });
      return nearest;
    }
    function onScroll() {
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          const nearest = nearestIndex();
          setCurrent(nearest);
          // Free scrolling (swipe/trackpad) retargets stepping immediately;
          // during a scrollToSlide animation the target is already set and
          // partial positions must not overwrite it.
          if (!animatingRef.current) targetRef.current = nearest;
        });
      }
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        animatingRef.current = false;
        targetRef.current = nearestIndex();
      }, 150);
    }
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(settleTimer);
    };
  }, []);

  function scrollToSlide(index: number) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const clamped = Math.max(0, Math.min(slides.length - 1, index));
    targetRef.current = clamped;
    animatingRef.current = true;
    const target = scroller.children[clamped] as HTMLElement | undefined;
    if (!target) return;
    // rect-based, not offsetLeft: the slide's offsetParent is the page (the
    // scroller isn't positioned), so offsetLeft would bake in the container's
    // own page offset and scroll past the slide.
    const left =
      target.getBoundingClientRect().left -
      scroller.getBoundingClientRect().left +
      scroller.scrollLeft;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ left, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      scrollToSlide(targetRef.current + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      scrollToSlide(targetRef.current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      scrollToSlide(0);
    } else if (e.key === "End") {
      e.preventDefault();
      scrollToSlide(slides.length - 1);
    }
  }

  return (
    <div role="region" aria-roledescription="carousel" aria-label="Products">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-sm text-muted-foreground tabular-nums" aria-hidden="true">
          {String(current + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollToSlide(targetRef.current - 1)}
            disabled={current === 0}
            aria-label="Previous product"
            className="rounded-md border border-border p-2 text-foreground transition-colors hover:border-accent/50 disabled:opacity-35 disabled:hover:border-border focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => scrollToSlide(targetRef.current + 1)}
            disabled={current === slides.length - 1}
            aria-label="Next product"
            className="rounded-md border border-border p-2 text-foreground transition-colors hover:border-accent/50 disabled:opacity-35 disabled:hover:border-border focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* div-based per the APG carousel pattern: role="group" is not an
          allowed role on li, and overriding li roles breaks the list's own
          structure (both are axe violations, found by the scan not assumed). */}
      <div
        ref={scrollerRef}
        tabIndex={0}
        aria-label="Product slides — use arrow keys to move between products"
        onKeyDown={onKeyDown}
        className="mt-6 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none [scrollbar-width:thin]"
      >
        {slides.map(({ product, dateline }, i) => (
          <div
            key={product.slug}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides.length}: ${product.name}`}
            className="flex w-[85vw] max-w-[24rem] shrink-0 snap-start flex-col rounded-lg border border-border bg-card p-6 md:w-[26rem] md:max-w-none"
          >
            <p className="text-muted-foreground flex flex-wrap items-baseline justify-between gap-x-3 text-xs tracking-[0.25em] uppercase">
              <span>
                {String(i + 1).padStart(2, "0")}
                {product.tier === "flagship" ? " · Flagship" : ""}
              </span>
              {dateline ? <span className="font-mono normal-case tracking-normal">{dateline}</span> : null}
            </p>

            <h3 className="font-heading mt-4 text-title font-semibold">{product.name}</h3>

            <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{product.tagline}</p>

            {product.metric ? (
              <div className="mt-5">
                <p className="text-muted-foreground text-xs tracking-[0.25em] uppercase">
                  {product.metric.label}
                </p>
                <p className="font-mono mt-1.5 text-lg font-semibold text-foreground tabular-nums">
                  {product.metric.value}
                </p>
              </div>
            ) : null}

            {product.storyLine ? (
              <blockquote className="border-accent mt-5 border-l-2 pl-4">
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {product.storyLine.text}
                </p>
              </blockquote>
            ) : null}

            {product.techChips ? (
              <p className="text-muted-foreground mt-5 flex flex-wrap gap-x-2 gap-y-1 text-xs tracking-wider uppercase">
                {product.techChips.map((chip, j) => (
                  <span key={chip}>
                    {j > 0 ? <span aria-hidden="true"> / </span> : null}
                    {chip}
                  </span>
                ))}
              </p>
            ) : null}

            {product.liveUrl || product.repoUrl ? (
              <div className={cn("mt-auto flex flex-wrap gap-4 pt-6")}>
                {product.liveUrl ? (
                  <a
                    href={product.liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${product.name} — view live`}
                    className="text-foreground hover:text-accent inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                    View it live
                  </a>
                ) : null}
                {product.repoUrl ? (
                  <a
                    href={product.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${product.name} — view source`}
                    className="text-foreground hover:text-accent inline-flex items-center gap-1.5 text-sm font-medium transition-colors"
                  >
                    <GithubIcon className="size-4" aria-hidden />
                    Source
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
