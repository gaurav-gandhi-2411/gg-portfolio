"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Wraps server-rendered children (e.g. a Card whose content comes from
 * build-time data) with a cursor-following radial glow. Deliberately
 * restrained — a soft highlight, not a spotlight — and CSS-driven off two
 * custom properties updated on mousemove, not a per-frame animation loop.
 *
 * `className`/`style` pass through to the wrapper for grid-stretch (h-full)
 * and stagger-delay use cases.
 */
export function CursorGlow({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--glow-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--glow-y", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      style={style}
      className={cn("group/glow relative", className)}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-xl opacity-0 transition-opacity duration-300 group-hover/glow:opacity-100 motion-reduce:hidden"
        style={{
          background:
            "radial-gradient(240px circle at var(--glow-x, 50%) var(--glow-y, 50%), color-mix(in oklab, var(--accent) 12%, transparent), transparent 70%)",
        }}
      />
      {children}
    </div>
  );
}
