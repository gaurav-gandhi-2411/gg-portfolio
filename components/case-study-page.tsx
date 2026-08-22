import Link from "next/link";
import { FlowDiagram } from "@/components/flow-diagram";
import { LinkButton } from "@/components/link-button";
import { MetricProvenance } from "@/components/metric-provenance";
import { PrintButton } from "@/components/print-button";
import { ProjectMark, type ProjectMarkId } from "@/components/project-mark";
import { StepCurve } from "@/components/step-curve";
import { availability } from "@/content/availability";
import { products as allProducts } from "@/content/products";
import { site } from "@/content/site";
import type { CaseStudy, Product } from "@/content/types";
import { getCaseStudyLastUpdated } from "@/lib/last-updated";
import { projectHue } from "@/lib/project-rhythm";
import { getProvenance } from "@/lib/provenance";
import { caseStudyReadingMinutes } from "@/lib/reading-time";
import type { RelatedProduct } from "@/lib/related-products";
import { SECTION_TITLES, headingId } from "@/lib/case-study-anchors";

/**
 * CONCEPT C — "one modular system": neither the homepage's language
 * extended into case studies (A), nor case studies kept deliberately
 * distinct (B). Every surface on the site is built from the same small set
 * of literal components at the same weight, wherever it appears: the same
 * centered section heading + rule mark components/section.tsx already
 * renders on the homepage renders here too; the same pill shape
 * components/project-filter.tsx's category filters use becomes both the
 * case study's section nav (reused as a wayfinding idiom, not a sidebar)
 * and how a result is presented (a stat chip, not a card or a table row).
 * One grammar, applied identically regardless of what kind of page it's on.
 */

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="case-heading-modular-wrap">
      <h2 id={headingId(title)} data-case-heading className="case-heading-modular">
        {title}
      </h2>
      <span aria-hidden="true" className="case-heading-modular-rule" />
    </div>
  );
}

export function CaseStudyPage({
  study,
  product,
  demo,
  related = [],
}: {
  study: CaseStudy;
  product: Product | undefined;
  demo?: React.ReactNode;
  related?: RelatedProduct[];
}) {
  const tocSections: string[] = [
    SECTION_TITLES.problem,
    SECTION_TITLES.approach,
    ...(study.architecture ? [SECTION_TITLES.architecture] : []),
    ...((study.decisions?.length ?? 0) > 0 ? [SECTION_TITLES.decisions] : []),
    ...(study.diagram ? [study.diagram.title] : []),
    ...((study.results?.length ?? 0) > 0 ? [SECTION_TITLES.results] : []),
    ...(study.story ? [study.story.title] : []),
    ...((study.closing?.length ?? 0) > 0 ? [SECTION_TITLES.closing] : []),
  ];

  const lastUpdated = getCaseStudyLastUpdated(study.slug);
  const readingMinutes = caseStudyReadingMinutes(study);
  const hue = projectHue(allProducts, study.slug);

  return (
    <main
      id="main"
      data-case-study
      style={{ "--case-hue": String(hue) } as React.CSSProperties}
      className="case-study-modular ambient-plane mx-auto w-full max-w-3xl flex-1 px-[var(--space-6)] pt-[var(--space-12)] pb-[var(--space-20)] md:pt-[var(--space-16)] lg:max-w-5xl"
    >
      <div aria-hidden="true" className="reading-progress" />

      <div className="flex flex-col items-center text-center">
        <p className="text-muted-foreground font-mono text-caption tracking-eyebrow uppercase">
          <Link
            href="/projects"
            className="focus-visible:outline-ring -my-2.5 inline-flex min-h-11 items-center transition-colors duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            ← All projects
          </Link>
        </p>

        <ProjectMark
          id={study.slug as ProjectMarkId}
          hue={hue}
          size={56}
          className="mark-idle mt-[var(--space-6)]"
        />
        <h1 className="font-heading text-display mt-[var(--space-4)] font-semibold tracking-tight text-foreground">
          {study.title}
        </h1>
        <p className="text-muted-foreground mt-[var(--space-4)] max-w-measure text-body-lg leading-relaxed">
          {study.dek}
        </p>
        <p className="text-muted-foreground mt-[var(--space-3)] font-mono text-caption">
          {lastUpdated && <>Last updated {lastUpdated} · </>}
          {readingMinutes} min read
        </p>

        <p className="mt-[var(--space-6)] flex flex-wrap justify-center gap-[var(--space-3)]">
          {study.links.map((link, i) => (
            <LinkButton key={link.href} href={link.href} variant={i === 0 ? "primary" : "secondary"}>
              {link.label} ↗
            </LinkButton>
          ))}
          <PrintButton />
        </p>
      </div>

      {/* The wayfinding rail — the exact pill shape
          components/project-filter.tsx's category filters use, reused here
          as section navigation instead of a sidebar box. Same component
          idiom, different job, on purpose. */}
      <nav aria-label="On this page" className="case-pill-nav">
        {tocSections.map((title) => (
          <a key={title} href={`#${headingId(title)}`} className="case-pill-nav-item">
            {title}
          </a>
        ))}
      </nav>

      <div data-case-article className="mx-auto min-w-0 max-w-2xl">
        <SectionHeading title={SECTION_TITLES.problem} />
        {study.problem.map((paragraph) => (
          <p key={paragraph.slice(0, 32)} className="text-muted-foreground mt-[var(--space-4)] text-base leading-relaxed">
            {paragraph}
          </p>
        ))}

        <SectionHeading title={SECTION_TITLES.approach} />
        {study.approach.map((paragraph) => (
          <p key={paragraph.slice(0, 32)} className="text-muted-foreground mt-[var(--space-4)] text-base leading-relaxed">
            {paragraph}
          </p>
        ))}

        {study.architecture && (
          <>
            <SectionHeading title={SECTION_TITLES.architecture} />
            {study.architecture.intro && (
              <p className="text-muted-foreground mt-[var(--space-4)] text-base leading-relaxed">
                {study.architecture.intro}
              </p>
            )}
            <div className="mt-[var(--space-6)]">
              <FlowDiagram stages={study.architecture.stages} label={`${study.title} architecture diagram`} />
            </div>
            {study.architecture.note && (
              <p className="text-muted-foreground mt-[var(--space-4)] text-sm leading-relaxed">
                {study.architecture.note}
              </p>
            )}
          </>
        )}

        {(study.decisions?.length ?? 0) > 0 && (
          <>
            <SectionHeading title={SECTION_TITLES.decisions} />
            <ol className="case-block-grid">
              {study.decisions?.map((decision) => (
                <li key={decision.sourceRef} className="case-block">
                  <p className="font-medium text-foreground">{decision.title}</p>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{decision.body}</p>
                </li>
              ))}
            </ol>
          </>
        )}

        {study.diagram && (
          <>
            <SectionHeading title={study.diagram.title} />
            <div className="mt-[var(--space-6)]">
              <StepCurve points={study.diagram.points} unit={study.diagram.unit} label={study.diagram.title} />
            </div>
            <p className="text-muted-foreground mt-[var(--space-4)] text-sm leading-relaxed">{study.diagram.caption}</p>
          </>
        )}

        {(study.results?.length ?? 0) > 0 && (
          <>
            <SectionHeading title={SECTION_TITLES.results} />
            <dl className="case-chip-row">
              {study.results?.map((result) => {
                const provenance = getProvenance(result.sourceRef, product?.repoUrl, study.verifiedAt);
                return (
                  <div key={result.sourceRef + result.label} className="case-chip relative">
                    <dd
                      className="case-chip-value value-settle"
                      data-format={result.format ?? "stat"}
                    >
                      <MetricProvenance info={provenance} label={result.label} selfAnchor={false}>
                        {result.value}
                      </MetricProvenance>
                    </dd>
                    <dt className="case-chip-label">
                      {result.label}
                      {result.detail && <span className="text-muted-foreground/70"> · {result.detail}</span>}
                    </dt>
                  </div>
                );
              })}
            </dl>
          </>
        )}

        {study.story && (
          <>
            <SectionHeading title={study.story.title} />
            {study.story.leadIn && (
              <p className="text-muted-foreground mt-[var(--space-4)] text-base leading-relaxed">
                {study.story.leadIn.text}
              </p>
            )}
            {study.story.body.map((paragraph) => {
              const text = typeof paragraph === "string" ? paragraph : paragraph.text;
              return (
                <p key={text.slice(0, 32)} className="text-muted-foreground mt-[var(--space-4)] text-base leading-relaxed">
                  {text}
                </p>
              );
            })}
          </>
        )}

        {demo}

        {(study.closing?.length ?? 0) > 0 && (
          <>
            <SectionHeading title={SECTION_TITLES.closing} />
            {study.closing?.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="text-muted-foreground mt-[var(--space-4)] text-base leading-relaxed">
                {paragraph}
              </p>
            ))}
          </>
        )}

        <div className="border-accent/30 bg-accent/5 print-hide mt-[var(--space-16)] flex flex-col items-center gap-[var(--space-3)] rounded-xl border px-[var(--space-6)] py-8 text-center">
          <p className="text-foreground text-base leading-relaxed">
            Building something like this? {availability.summary}
          </p>
          <p className="flex flex-wrap justify-center gap-[var(--space-3)]">
            <LinkButton href={`mailto:${site.email}`} variant="primary">
              Email me ↗
            </LinkButton>
            <LinkButton href={site.resumeUrl} variant="secondary">
              View resume ↗
            </LinkButton>
          </p>
        </div>

        {related.length > 0 && (
          <div className="print-hide mt-[var(--space-10)]">
            <div className="case-heading-modular-wrap">
              <h2 className="case-heading-modular">Related projects</h2>
              <span aria-hidden="true" className="case-heading-modular-rule" />
            </div>
            <ol className="case-block-grid mt-[var(--space-4)]">
              {related.map(({ product: relatedProduct }) => (
                <li key={relatedProduct.slug} className="case-block">
                  <Link
                    href={`/work/${relatedProduct.slug}`}
                    className="focus-visible:outline-ring flex items-center gap-[var(--space-2)] font-medium text-foreground transition-colors duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                  >
                    <ProjectMark
                      id={relatedProduct.slug as ProjectMarkId}
                      hue={projectHue(allProducts, relatedProduct.slug)}
                      size={22}
                      className="mark-idle shrink-0"
                    />
                    {relatedProduct.name}
                  </Link>
                  <p className="text-muted-foreground mt-1.5 line-clamp-2 text-sm leading-snug">
                    {relatedProduct.tagline}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="border-border/40 mt-[var(--space-10)] flex flex-col items-center gap-[var(--space-5)] border-t pt-[var(--space-10)] text-center">
          <p className="text-muted-foreground text-sm">Want to see it for yourself?</p>
          <p className="flex flex-wrap justify-center gap-[var(--space-3)]">
            {study.links.map((link, i) => (
              <LinkButton key={link.href} href={link.href} variant={i === 0 ? "primary" : "secondary"}>
                {link.label} ↗
              </LinkButton>
            ))}
          </p>
          <Link
            href="/projects"
            className="text-accent focus-visible:outline-ring -my-2.5 inline-flex min-h-11 items-center text-sm font-medium transition-colors duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            ← Back to all projects
          </Link>
        </div>
      </div>
    </main>
  );
}
