"use client";

import { HeatToy } from "@/components/heat-toy";

/**
 * Wraps the existing HeatToy widget (unmodified) in a REPL/prompt frame so
 * it reads as a live command running inside the console, not a form
 * floating in whitespace. `"use client"` only because HeatToy itself is a
 * client component (fetches vocab, holds guess state) — no new state lives
 * here.
 */
export function ReplPanel() {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-xs text-muted-foreground">
        <span className="text-accent">$</span> ./heat-toy --daily --explain
      </p>
      <p className="font-mono text-xs leading-relaxed text-muted-foreground">
        Semantic word game — cosine similarity against today&apos;s hidden word, same warmth
        mechanic behind{" "}
        <a
          href="https://playwarmer.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Warmer
        </a>
        .
      </p>
      <div className="rounded-md border border-border bg-background p-4">
        <HeatToy />
      </div>
    </div>
  );
}
