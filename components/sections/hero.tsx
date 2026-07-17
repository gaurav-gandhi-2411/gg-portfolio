import { InlineLink } from "@/components/inline-link";
import { Monogram } from "@/components/monogram";
import { site } from "@/content/site";
import { heroIntro } from "@/content/about";
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
 * Wave 11 hero — wow moment #2. Fully centered on the page's single axis
 * (GG's direction; the wave-6 left-aligned byline left the right half of
 * the viewport empty). The intro is now ONE line — sentence 1 of the
 * wave-10-approved paragraph, verbatim (the rest opens Work, where it
 * points). Two concentrated touches, calm everywhere else:
 *   - .hero-halo: a slow-drifting blurred indigo disc behind the stack
 *     (decorative, aria-hidden, transform-only, static under
 *     prefers-reduced-motion);
 *   - .stat-figure: gradient numerals on the stats row (both gradient
 *     endpoints independently pass AA on this background — globals.css).
 *
 * Deliberately NOT animated: every text node renders at full opacity from
 * first paint. Wave 9 proved an onload hero cascade races axe-core's
 * contrast check; the entrance feeling comes from the boot loader's
 * curtain reveal (components/boot-loader.tsx), which never dips content
 * opacity. Stats stay the wave-10 set (GG-ratified): two derived, one
 * verbatim from the resume (resume:indium-senior-lead).
 */
export function Hero() {
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
    <header className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-24 pb-16 text-center sm:pt-32 md:pb-20">
      <div aria-hidden="true" className="hero-halo" />

      <Monogram className="size-11" />

      <h1 className="font-heading text-display mt-8 font-semibold tracking-tight text-foreground">
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

      <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-foreground">{heroIntro}</p>

      <p className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-base">
        <InlineLink href={site.resumeUrl} download>
          Resume
        </InlineLink>
        <InlineLink href={site.githubUrl}>GitHub</InlineLink>
        <InlineLink href={site.linkedinUrl}>LinkedIn</InlineLink>
        <InlineLink href={`mailto:${site.email}`} sameTab>
          Email
        </InlineLink>
      </p>

      <dl className="border-border/40 mt-14 grid w-full max-w-2xl grid-cols-1 gap-x-8 gap-y-6 border-t pt-8 sm:grid-cols-3">
        {heroStats.map((stat) => (
          <div key={stat.sourceRef} className="flex flex-col items-center gap-1.5">
            <dd className="stat-figure font-mono text-heading font-medium">{stat.value}</dd>
            <dt className="text-muted-foreground max-w-[18ch] text-sm leading-snug">
              {stat.label}
            </dt>
          </div>
        ))}
      </dl>
    </header>
  );
}
