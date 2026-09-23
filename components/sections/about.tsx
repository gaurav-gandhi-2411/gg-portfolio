import { Section } from "@/components/section";
import { aboutParagraphs, skillChips } from "@/content/about";

/**
 * Wave 12 — About Me: three short first-person paragraphs. Prose stays
 * left-aligned inside the centered column (centered multi-paragraph text
 * is harder to read; the section header carries the centered rhythm).
 *
 * Wave 13 — desktop composition: at lg the skills move out of the closing
 * one-liner into a right-rail panel beside the prose, so the 1024–1600px
 * band holds two real columns instead of a narrow strand of text. The
 * mobile/tablet layout is byte-identical to wave 12's. (The two renderings
 * are display-toggled — display:none removes the hidden one from the
 * accessibility tree, so nothing announces twice.)
 *
 * GG's launch-review round two dropped the RevealGroup wrapper this prose
 * used to sit in — components/section.tsx's own `.section-content` now
 * carries a continuous, scroll-scrubbed entrance for every section built on
 * it (components/motion/section-depth.tsx), which is the thing that
 * replaced the one-shot IntersectionObserver reveal RevealGroup was. The
 * skills panel is a `.section-card` now (app/sections-motion.css) for the
 * same pointer-tilt every other content card below the hero gets.
 */
export function About() {
  return (
    <Section id="about" label="About me" width="wide">
      {/*
       * Direction B (proposal, not merged): HeadlineStats is gone from here.
       * Two of its three numbers now live in the hero's own impact panel
       * (components/sections/hero.tsx) — keeping this row too would put the
       * same $10M+ and ~70% on the page twice, which is exactly the mistake
       * hero.tsx's own header comment documents retiring the old hero stat
       * row for (one of them repeating a figure under a different label).
       * The third number (50M+ documents) is still sourced in
       * content/stats.ts; it just has no home on this exploration's
       * homepage yet.
       */}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-x-14">
        <div className="flex flex-col items-center gap-[var(--space-5)] lg:items-start">
          {aboutParagraphs.map((paragraph) => (
            <p
              key={paragraph.slice(0, 32)}
              className="text-muted-foreground max-w-measure text-base leading-relaxed"
            >
              {paragraph}
            </p>
          ))}
          <p className="border-border/40 text-muted-foreground max-w-measure border-t pt-5 text-sm leading-relaxed lg:hidden">
            Working across {skillChips.join(" · ")}.
          </p>
        </div>

        <aside className="hidden lg:block" aria-label="Core skills">
          <div className="section-card border-border/40 rounded-xl border p-[var(--space-5)]">
            <h3 className="text-muted-foreground font-mono text-caption tracking-eyebrow uppercase">
              Working across
            </h3>
            <ul className="mt-[var(--space-4)] flex flex-col gap-[var(--space-2-5)]">
              {skillChips.map((chip) => (
                <li key={chip} className="text-muted-foreground text-sm leading-snug">
                  {chip}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </Section>
  );
}
