"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Wave 16 — the one persistent entry point into the flagship RAG chatbot
 * demo (app/ask). Deliberately a plain corner link, not a floating
 * modal/expand panel: /ask is a dedicated page ("flagship demo"), so this
 * component's only job is getting a visitor there. Hidden on /ask itself —
 * a launcher back to the page you're already reading is dead weight.
 *
 * Styled like LinkButton's quiet "secondary" voice (components/link-button.tsx)
 * but fixed-position, matching this site's existing fixed-overlay precedent
 * (components/boot-loader.tsx) at a lower z-index (40) so it never competes
 * with the boot curtain or reading-progress bar (both z-60) or the sticky
 * nav (z-50) — this sits in the opposite (bottom) corner from all of them.
 */
export function ChatLauncher() {
  const pathname = usePathname();
  if (pathname === "/ask") return null;

  return (
    <nav aria-label="Ask AI assistant" className="fixed right-5 bottom-5 z-40">
      <Link
        href="/ask"
        className="border-border/60 bg-card/90 text-foreground hover:border-accent/60 hover:bg-card focus-visible:outline-ring flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium backdrop-blur-md transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 4.5h16a1 1 0 0 1 1 1V15a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" />
        </svg>
        Ask about my work
      </Link>
    </nav>
  );
}
