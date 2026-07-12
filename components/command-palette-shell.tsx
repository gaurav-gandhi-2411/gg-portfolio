"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const CommandPalette = dynamic(() =>
  import("./command-palette").then((m) => m.CommandPalette)
);

/**
 * Deliberately tiny — this global keydown listener is the only eager cost
 * of the command palette. The palette UI (search, item list, keyboard nav)
 * only loads once a visitor actually triggers it.
 */
export function CommandPaletteShell() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isTypingTarget =
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA"].includes(e.target.tagName);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setLoaded(true);
        setOpen((v) => !v);
      } else if (e.key === "/" && !isTypingTarget) {
        e.preventDefault();
        setLoaded(true);
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 font-mono text-xs text-muted-foreground shadow-lg transition-colors hover:border-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        Search
      </button>
      {loaded && <CommandPalette open={open} onOpenChange={setOpen} />}
    </>
  );
}
