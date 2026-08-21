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
 *
 * UI/UX wave (2026-07-30) — design-reviewer caught a real collision this
 * wave's own lg-breakpoint density fix newly exposed: case-study-page.tsx's
 * sticky right rail (`hidden lg:block`, on-this-page nav + metric + related
 * projects) can extend low enough down a tall case study that its bottom
 * content lands under this fixed bottom-right pill, making links under it
 * unclickable, not just visually crowded. The rail's horizontal position
 * shifts with viewport width, so a static CSS offset can't reliably clear
 * it — hidden here specifically where the rail exists (/work/[slug], lg+)
 * rather than computing that geometry.
 *
 * GG's launch-review round two found the same shape below lg, where there
 * is no rail: a 30-route walk at 390px caught this pill sitting over live
 * paragraph text on /work/triageiq mid-scroll, confirmed by real bounding
 * boxes, not a screenshot artifact. The mechanism is the one this
 * component already exists to avoid — a fixed corner element and a page
 * long enough to scroll any given line of text through that corner — it
 * was just never checked below the one breakpoint the sticky rail happens
 * to appear at. Case studies are exactly the long-scrolling prose this
 * hits, on every width, so the hide is no longer `lg:`-qualified: it hides
 * on every /work/[slug] route, full stop. Case-study pages already carry
 * their own strong CTAs (the rail's links on lg+, "Work with me" below
 * it) — this was never the only path forward there, on any width.
 */
export function ChatLauncher() {
  const pathname = usePathname();
  if (pathname === "/ask") return null;
  if (pathname.startsWith("/work/")) return null;

  return (
    <nav aria-label="Ask AI assistant" className="fixed right-5 bottom-5 z-40">
      <Link
        href="/ask"
        className="border-border/60 bg-card/90 text-foreground hover:border-accent/60 hover:bg-card focus-visible:outline-ring flex min-h-11 items-center gap-[var(--space-2)] rounded-full border px-[var(--space-4)] py-[var(--space-2-5)] text-sm font-medium backdrop-blur-md transition-[transform,box-shadow,border-color,background-color] duration-[var(--dur-fast)] ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
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
