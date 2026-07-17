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
      const kf: Keyframe[] = [
        { opacity: 0, transform: "translateY(10px)" },
        { opacity: 1, transform: "translateY(0)" },
      ];
      const easing = "cubic-bezier(0.16, 1, 0.3, 1)";
      Array.from(el!.children).forEach((child, i) => {
        child.animate(kf, { duration: 450, delay: i * stepMs, easing, fill: "backwards" });
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

  const Comp = Tag as React.ElementType;
  return (
    <Comp ref={ref} className={className}>
      {children}
    </Comp>
  );
}
