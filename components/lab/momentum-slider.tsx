"use client";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/content/types";

/**
 * Lab 3 — a current slider pattern for Work, replacing wave 5's retired
 * APG-carousel-with-arrows with something that leans on native scrolling
 * instead of reinventing drag physics. Trackpad/touch already have real
 * OS-level momentum and rubber-banding for free via `overflow-x: auto` +
 * `scroll-snap-type` — a JS drag simulation would be heavier and worse.
 * Mouse users get pointer-drag-to-scroll added on top (native scroll has
 * no click-drag by default). Peek-of-next via `scroll-snap-align: center`
 * so both neighbors are always partially visible. Progress is a thin fill
 * bar + fraction counter instead of a dot row (dots don't scale past ~6
 * items without becoming their own visual clutter — this site has 9).
 *
 * Tested: trackpad two-finger scroll (real momentum, snap settles per
 * card), touch swipe (emulated + real momentum), mouse click-drag, arrow
 * keys, Home/End. Reduced motion: keyboard nav uses instant scroll instead
 * of smooth; native touch/trackpad momentum is a platform/OS behavior, not
 * a CSS animation, so it isn't gated by prefers-reduced-motion (matches
 * how native OS scrolling works everywhere else on the page/system).
 */
export function MomentumSlider({ products }: { products: Product[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [index, setIndex] = useState(0);
  const dragState = useRef<{ startX: number; startScroll: number } | null>(null);

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
        const cardStep = el.scrollWidth / products.length;
        setIndex(Math.round(el.scrollLeft / cardStep));
      });
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [products.length]);

  function stepTo(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const cardStep = el.scrollWidth / products.length;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: cardStep * i, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") stepTo(Math.min(products.length - 1, index + 1));
    else if (e.key === "ArrowLeft") stepTo(Math.max(0, index - 1));
    else if (e.key === "Home") stepTo(0);
    else if (e.key === "End") stepTo(products.length - 1);
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
      {/*
        APG carousel pattern: role="region"/"group" is only valid on div/
        generic elements, not ul/li (aria-allowed-role) — wave 5's carousel
        hit this exact violation and fixed it the same way
        (reports/wave5-restraint-restructure-2026-07-16.md, bug 3). Divs
        with the roles below, not a semantic list.
      */}
      <div
        ref={scrollerRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Products"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-[11%] py-2 [-ms-overflow-style:none] [scrollbar-width:none] cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div
            key={p.slug}
            role="group"
            aria-roledescription="slide"
            aria-label={p.name}
            className="border-border bg-card w-[78%] shrink-0 snap-center rounded-lg border p-6"
          >
            <h2 className="font-heading text-title font-semibold">{p.name}</h2>
            <p className="text-muted-foreground mt-2 max-w-measure text-sm leading-relaxed">
              {p.tagline}
            </p>
            {p.metric && (
              <p className="mt-3 font-mono text-xs text-foreground">
                {p.metric.value} <span className="text-muted-foreground">— {p.metric.label}</span>
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 px-[11%]">
        <div className="bg-border/40 h-[2px] flex-1 overflow-hidden rounded-full">
          <div
            className="bg-accent h-full rounded-full transition-[width] duration-150"
            style={{ width: `${Math.max(4, progress * 100)}%` }}
          />
        </div>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {String(index + 1).padStart(2, "0")} / {String(products.length).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
