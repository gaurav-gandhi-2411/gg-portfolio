"use client";

import { useEffect, useRef, useState } from "react";
import { EvalFigure } from "@/components/eval-figure";
import { InlineLink } from "@/components/inline-link";
import { TRIAGEIQ_PANEL_ID, TriageiqClassifyToggle } from "@/components/triageiq-classify-disclosure";
import { TriageiqClassifyPanel } from "@/components/triageiq-classify-panel";
import type { Product } from "@/content/types";

export interface WorkSlideData {
  product: Product;
  dateline?: string;
  tracegaugeDownloads?: number;
}

/**
 * Wave 9 — production integration of the wave-8 Lab 3 prototype
 * (reports/wave8-lab-2026-07-17.md), replacing wave 6's flat Work list per
 * GG's integration map. All 10 products, one slider: native scroll-snap
 * for real trackpad/touch momentum (free, real OS-level physics — a JS
 * drag simulation would be heavier and worse than what the platform
 * already gives), peek-of-next via `scroll-snap-align: center`, pointer-
 * drag added for mouse (native scrolling has no click-drag by default),
 * and a thin progress bar + fraction counter instead of a dot row (10
 * items doesn't scale cleanly to dots). Flagship slides carry their real
 * eval figure (components/eval-figure.tsx, now with a scroll-linked
 * draw-in rooted to THIS component's own scroll container — see `rootEl`
 * below — not the page viewport, so a figure draws in when its slide is
 * actually scrolled to, not just when the section is on-screen).
 *
 * a11y: div-based APG carousel pattern from the start — role="region"/
 * "group" is only valid on div/generic elements (aria-allowed-role), the
 * exact violation wave 5's original carousel hit, and that this wave's own
 * Lab 3 prototype re-hit and fixed (reports/wave8-lab, Lab 3 section).
 */
export function WorkSlider({ slides }: { slides: WorkSlideData[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  // Separate from scrollerRef: EvalFigure's rootEl is read during RENDER
  // (to build its JSX), and a plain ref reads null on the first render
  // (refs attach after commit) with no guaranteed later re-render to pick
  // up the real node — state, set from the same callback ref below,
  // correctly triggers the one extra re-render needed once the DOM node
  // exists (bug caught during this wave's own build, not carried from Lab 3).
  const [scrollerEl, setScrollerEl] = useState<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [index, setIndex] = useState(0);
  const [showClassifier, setShowClassifier] = useState(false);
  const classifierPanelRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; startScroll: number } | null>(null);

  // The panel renders outside the card that triggers it (see
  // triageiq-classify-disclosure.tsx) — scroll it into view on open so
  // "click here → content appears further down" doesn't strand the
  // visitor with no visible feedback at the click site (design-review
  // finding, wave 9).
  useEffect(() => {
    if (!showClassifier) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    classifierPanelRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
    });
  }, [showClassifier]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!el) return;
        const max = el.scrollWidth - el.clientWidth;
        setProgress(max > 0 ? el.scrollLeft / max : 0);
        const cardStep = el.scrollWidth / slides.length;
        setIndex(Math.round(el.scrollLeft / cardStep));
      });
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [slides.length]);

  function stepTo(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const cardStep = el.scrollWidth / slides.length;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: cardStep * i, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") stepTo(Math.min(slides.length - 1, index + 1));
    else if (e.key === "ArrowLeft") stepTo(Math.max(0, index - 1));
    else if (e.key === "Home") stepTo(0);
    else if (e.key === "End") stepTo(slides.length - 1);
    else return;
    e.preventDefault();
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "mouse") return; // touch/trackpad already scroll natively
    const el = scrollerRef.current;
    if (!el) return;
    dragState.current = { startX: e.clientX, startScroll: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragState.current || !scrollerRef.current) return;
    const dx = e.clientX - dragState.current.startX;
    scrollerRef.current.scrollLeft = dragState.current.startScroll - dx;
  }
  function onPointerUp() {
    dragState.current = null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={(node) => {
          scrollerRef.current = node;
          setScrollerEl(node);
        }}
        role="region"
        aria-roledescription="carousel"
        aria-label="Products"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="flex snap-x snap-mandatory items-start gap-4 overflow-x-auto px-[8%] py-2 [-ms-overflow-style:none] [scrollbar-width:none] cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
      >
        {slides.map(({ product, dateline, tracegaugeDownloads }) => {
          const isFlagship = product.tier === "flagship";
          const figure =
            product.figure && product.metric ? (
              <EvalFigure figure={product.figure} label={product.metric.label} rootEl={scrollerEl} />
            ) : null;

          return (
            <div
              key={product.slug}
              role="group"
              aria-roledescription="slide"
              aria-label={product.name}
              className="border-border bg-card w-[80%] max-w-[34rem] shrink-0 snap-center rounded-lg border p-6 md:p-8"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h3 className="font-heading text-title font-semibold text-foreground">
                  {product.name}
                </h3>
                {dateline && (
                  <span className="text-muted-foreground font-mono text-xs">{dateline}</span>
                )}
              </div>

              <p className="text-muted-foreground mt-2 text-sm leading-relaxed md:text-base">
                {product.tagline}
              </p>

              {figure && <div className="mt-4">{figure}</div>}

              {!figure && product.metric && (
                <p className="mt-3 text-sm">
                  <span className="font-mono font-medium text-foreground">
                    {product.metric.value}
                  </span>{" "}
                  <span className="text-muted-foreground">— {product.metric.label}</span>
                </p>
              )}

              {isFlagship && product.storyLine && (
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                  {product.storyLine.text}
                </p>
              )}

              {product.slug === "tracegauge" && (
                <div className="mt-3 flex flex-col gap-2">
                  <code className="border-border bg-background text-foreground w-fit rounded-md border px-3 py-1.5 font-mono text-xs">
                    pip install tracegauge
                  </code>
                  {tracegaugeDownloads !== undefined && (
                    <p className="text-muted-foreground font-mono text-xs">
                      {tracegaugeDownloads.toLocaleString()} downloads last week
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 flex gap-5 text-sm">
                {product.liveUrl && <InlineLink href={product.liveUrl}>Live ↗</InlineLink>}
                {product.repoUrl && <InlineLink href={product.repoUrl}>Source ↗</InlineLink>}
              </div>

              {product.slug === "triageiq" && (
                <TriageiqClassifyToggle
                  open={showClassifier}
                  onToggle={() => setShowClassifier((o) => !o)}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 px-[8%]">
        <div className="bg-border/40 h-[2px] flex-1 overflow-hidden rounded-full">
          <div
            className="bg-accent h-full rounded-full transition-[width] duration-150"
            style={{ width: `${Math.max(4, progress * 100)}%` }}
          />
        </div>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </span>
      </div>

      {/* Rendered in normal block flow, not inside the scrolling card —
          see triageiq-classify-disclosure.tsx for why a floating popover
          anchored to the card doesn't work here. */}
      {showClassifier && (
        <div
          ref={classifierPanelRef}
          id={TRIAGEIQ_PANEL_ID}
          className="border-border bg-card mx-[8%] rounded-lg border p-6"
        >
          <TriageiqClassifyPanel />
        </div>
      )}
    </div>
  );
}
