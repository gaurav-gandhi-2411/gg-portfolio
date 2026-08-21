"use client";

import { useEffect, useRef } from "react";

/**
 * Wave 9 — the site's default reveal pattern, replacing wave 6's static
 * instant-pop-in globally (production hardening of the wave-8 Lab 2
 * prototype, reports/wave8-lab-2026-07-17.md).
 *
 * Structural safety (the exact thing wave 6 audited wave 5 for — reports/
 * wave6-audit-2026-07-17.md finding 8 — a page blank without JS): this
 * component NEVER sets an initial hidden state via CSS class or style.
 * Children render through completely normal — fully visible, final
 * content, no wrapper opacity. `Element.animate()` is called imperatively,
 * per real DOM child, only from an effect that already confirmed the
 * browser can run it (mount, for `mode="onload"`; IntersectionObserver,
 * for `mode="onview"`). `fill: "backwards"` paints the animation's hidden
 * starting keyframe only for the duration the animation is actually
 * running — before JS executes, during hydration lag, or with JS
 * disabled entirely, the DOM's real rendered state is the only state that
 * ever exists. Reduced motion skips `.animate()` entirely; nothing to
 * disable, because nothing was ever hidden.
 *
 * Generic by design: iterates `containerRef.current.children` (real DOM
 * elements after render) rather than requiring per-child refs, so any
 * section's existing markup can opt in by wrapping its top-level pieces —
 * no per-component ref plumbing.
 */
export function RevealGroup({
  children,
  mode = "onview",
  stepMs = 55,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  mode?: "onload" | "onview";
  stepMs?: number;
  className?: string;
  as?: "div" | "dl";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function run() {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      // 20px/600ms, not the original 10px/450ms (GG's launch review: "the
      // hero moves and nothing else does" — a 10px/450ms rise reads as
      // barely perceptible next to the hero's continuous parallax, easy to
      // miss on a normal scroll speed even though the mechanism was firing
      // correctly the whole time). Amplitude and duration only; the
      // structural safety this component's header documents (never an
      // initial hidden state outside this imperative call) is unchanged.
      const kf: Keyframe[] = [
        { opacity: 0, transform: "translateY(20px)" },
        { opacity: 1, transform: "translateY(0)" },
      ];
      const easing = "cubic-bezier(0.16, 1, 0.3, 1)";
      Array.from(el!.children).forEach((child, i) => {
        child.animate(kf, { duration: 600, delay: i * stepMs, easing, fill: "backwards" });
      });
    }

    if (mode === "onload") {
      run();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          run();
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Two literal branches, not a single polymorphic <Tag> render: `ref` is
  // typed HTMLElement (this component only ever calls generic Element/
  // HTMLElement methods on it, never anything div- or dl-specific), and
  // @types/react 19.2.18 now resolves a union-tag's ref prop as an
  // INTERSECTION of each branch's own element type — no single ref type
  // (including a union) satisfies "assignable to both HTMLDivElement AND
  // HTMLDListElement refs at once". Each branch below casts only to its
  // own matching type, which is sound (this is genuinely a div ref when
  // Tag is "div"), unlike the previous `as React.ElementType` erasure this
  // replaces, which discarded ref-safety across the board.
  if (Tag === "dl") {
    return (
      <dl ref={ref as React.RefObject<HTMLDListElement | null>} className={className}>
        {children}
      </dl>
    );
  }
  return (
    <div ref={ref as React.RefObject<HTMLDivElement | null>} className={className}>
      {children}
    </div>
  );
}
