import { InlineLink } from "@/components/inline-link";
import { Monogram } from "@/components/monogram";
import { site } from "@/content/site";
import { aboutParagraphs } from "@/content/about";
import { liveProductCount, products } from "@/content/products";
import type { Stat } from "@/content/types";

/**
 * Whole years since the first data-science role on the resume (TCS, Jul 2021
 * — content/experience.ts dateRange, resume p.1). Computed, not hand-typed,
 * so it can never silently go stale (same drift-proofing rationale as
 * liveProductCount — see provenance.md#derived:career-years).
 */
function careerYears(): number {
  const start = Date.UTC(2021, 6, 1); // Jul 2021
  return Math.floor((Date.now() - start) / (365.25 * 24 * 3600 * 1000));
}

/**
 * Wave 6 hero: the wave-5 "byline" structure (GG-ratified: left-aligned,
 * name-led, 40-64px cap) rebuilt on the shared max-w-5xl grid so its left
 * edge matches every section below (the audit found hero at max-w-3xl vs.
 * 4xl elsewhere — a 64px misalignment on the very first scroll).
 *
 * What changed vs. wave 5, per the audit:
 * - The intro is About's lead paragraph, verbatim — hero tagline and About
 *   lead were near-duplicates 800px apart, so the About section dissolved
 *   and its one good paragraph now opens the page.
 * - CTA buttons → underlined text links; status pill → plain accent text
 *   (the green pill was a second accent color doing decoration, not work).
 * - Count-up animation removed; stats render as a quiet mono row. All three
 *   values stay derived, never hand-typed (rule 65b), and the puzzle fetch
 *   stays fail-soft ("—", never a stale number).
 *
 * Wave 9: tried RevealGroup (mode="onload") here first, cascading each
 * line in on first paint as the site's new default reveal pattern (GG's
 * integration map, item 2) — reverted after this wave's own verification
 * found it flaky: axe-core CLI's color-contrast check raced the ~800ms
 * hero cascade and intermittently caught text mid-fade (2 of 3 runs
 * failed, 1 passed, on IDENTICAL code — a transient opacity dip, not a
 * real token/contrast defect, confirmed by reading the same elements'
 * settled computed styles). Above-the-fold, first-paint content animating
 * in from invisible is exactly the "reveal-on-load flash" wave 2/3
 * deliberately avoided for Hero, now with a second, concrete reason not
 * to reintroduce it: it races real accessibility tooling, not just
 * cosmetics. RevealGroup's "onview" mode (used everywhere below the fold)
 * doesn't have this race — it only fires once a section is already
 * scrolled into view, well after any first-paint snapshot. Spacing is
 * explicit per-child margin (unchanged from the RevealGroup attempt) so
 * the rhythm matches every other wave-9 section.
 */
export function Hero() {
  // Wave 10 stats (GG's feedback: the previous three — product count,
  // Warmer puzzle count, preprint count — read wrong to him). Rebalanced to
  // career + independent work with plain labels; alternates in
  // reports/wave10. All three stay verifiable: two derived, one verbatim
  // from the resume (resume:indium-senior-lead).
  const heroStats: Stat[] = [
    {
      value: String(careerYears()),
      label: "years in data science & ML",
      sourceRef: "derived:career-years",
    },
    {
      value: String(liveProductCount(products)),
      label: "AI products live today",
      sourceRef: "derived:products-live-count",
    },
    {
      value: "5",
      label: "people on the data-science team I lead",
      sourceRef: "resume:indium-senior-lead",
    },
  ];

  return (
    <header className="mx-auto w-full max-w-5xl px-6 pt-20 pb-12 sm:pt-24 md:pb-16">
      <div>
        <Monogram />

        <h1 className="font-heading text-display mt-10 font-semibold tracking-tight text-foreground">
          {site.name}
        </h1>

        <p className="text-muted-foreground mt-4 text-lg">
          {site.role} · {site.location} ·{" "}
          {/* Accent implies interactivity — so make it real: the status is a
              link to the section where acting on it happens (review fix). */}
          <a
            href="#contact"
            className="text-accent decoration-accent/40 underline decoration-1 underline-offset-4 transition-colors hover:decoration-accent focus-visible:decoration-accent motion-reduce:transition-none"
          >
            {site.status}
          </a>
        </p>

        <p className="mt-6 max-w-measure text-lg leading-relaxed text-foreground">
          {aboutParagraphs[0]}
        </p>

        <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-base">
          <InlineLink href={site.resumeUrl} download>
            Resume
          </InlineLink>
          <InlineLink href={site.githubUrl}>GitHub</InlineLink>
          <InlineLink href={site.linkedinUrl}>LinkedIn</InlineLink>
          <InlineLink href={`mailto:${site.email}`} sameTab>
            Email
          </InlineLink>
        </p>

        <dl className="border-border/40 mt-12 grid w-full grid-cols-1 gap-x-8 gap-y-4 border-t pt-6 sm:grid-cols-3">
          {heroStats.map((stat) => (
            <div key={stat.sourceRef} className="flex flex-col gap-1">
              <dd className="font-mono text-lead font-medium text-foreground">{stat.value}</dd>
              <dt className="text-muted-foreground text-sm leading-snug">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </header>
  );
}
