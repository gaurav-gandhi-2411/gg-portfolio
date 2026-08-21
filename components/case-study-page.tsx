import Link from "next/link";
import { CaseStudyRail } from "@/components/case-study-rail";
import { FlowDiagram } from "@/components/flow-diagram";
import { InlineLink } from "@/components/inline-link";
import { LinkButton } from "@/components/link-button";
import { MetricProvenance } from "@/components/metric-provenance";
import { PrintButton } from "@/components/print-button";
import { StepCurve } from "@/components/step-curve";
import { availability } from "@/content/availability";
import { products as allProducts } from "@/content/products";
import { site } from "@/content/site";
import { CATEGORIES, type CaseStudy, type Product } from "@/content/types";
import { getCaseStudyLastUpdated } from "@/lib/last-updated";
import { projectHue } from "@/lib/project-rhythm";
import { getProvenance } from "@/lib/provenance";
import { caseStudyReadingMinutes } from "@/lib/reading-time";
import type { RelatedProduct } from "@/lib/related-products";
import { SECTION_TITLES, headingId } from "@/lib/case-study-anchors";

/**
 * Wave 12 — the /work/[slug] case-study template: numbered sections, one
 * idea per section, novice-readable, everything server-rendered; `demo`
 * is the one interactive slot injected by the route.
 *
 * Wave 13 — desktop composition (GG's standing 1024–1600px complaint):
 * at lg the page becomes content column + sticky right rail (on-this-page
 * anchors, the headline metric, project links) so the case study reads
 * like a documented spread instead of a strand in a void. Below lg the
 * wave-12 single column is unchanged (breakpoint moved from xl to lg in
 * the 2026-07-30 UI/UX wave — see section.tsx). A scroll-driven reading
 * progress bar (pure CSS, @supports-gated) sits above the nav.
 */

function SectionHeading({ index, title }: { index: number; title: string }) {
  return (
    <h2
      id={headingId(title)}
      data-case-heading
      /* Alternating rhythm. Odd sections hang their numeral out in the
       * margin under a hue rule; even ones keep it inline. Walking down a
       * page of identically stacked blocks is most of why these read as
       * documents rather than as a piece of work, and the eye needs
       * something to count by. */
      data-rhythm={index % 2 === 0 ? "even" : "odd"}
      className="case-heading"
    >
      <span aria-hidden="true" className="case-heading-index">
        {String(index).padStart(2, "0")}
      </span>
      {title}
    </h2>
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
  /** Wave 16 — other projects sharing a category, most-related first (lib/related-products.ts). */
  related?: RelatedProduct[];
}) {
  // Titles come from lib/case-study-anchors.ts, which the chatbot indexer
  // also reads. /ask cites a chunk and links to the section it came from, and
  // that link is only correct while the fragment it emits is the id this page
  // renders. One list, two readers, no third copy to drift.
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
  let sectionIndex = 0;
  const next = () => ++sectionIndex;

  const lastUpdated = getCaseStudyLastUpdated(study.slug);
  const readingMinutes = caseStudyReadingMinutes(study);

  return (
    <main
      id="main"
      data-case-study
      /* The project's own hue, the same one its card carried on the grid, so
       * arriving here feels like following that card rather than landing on
       * a generic page. Only surfaces read it; every piece of text stays on
       * the neutral tokens, so no project's colour can move a contrast
       * ratio. */
      style={{ "--case-hue": String(projectHue(allProducts, study.slug)) } as React.CSSProperties}
      className="case-study mx-auto w-full max-w-2xl flex-1 px-[var(--space-6)] pt-[var(--space-12)] pb-[var(--space-20)] md:pt-[var(--space-16)] lg:max-w-5xl"
    >
      <div aria-hidden="true" className="reading-progress" />
      {/* Full bleed, breaking out of the column the article is set in. A case
          study used to open with a back-link and a heading on the same flat
          plane as its body copy, which is a document, not a piece of work
          being presented. */}
      <div aria-hidden="true" className="case-opening-wash" />

      <div className="lg:grid lg:grid-cols-[minmax(0,42rem)_15rem] lg:justify-between lg:gap-x-12">
        <div data-case-article className="min-w-0">
          <p className="text-muted-foreground font-mono text-caption tracking-eyebrow uppercase">
            <Link
              href="/projects"
              className="focus-visible:outline-ring -my-2.5 inline-flex min-h-11 items-center transition-colors duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
            >
              ← All projects
            </Link>
          </p>

          <h1 className="font-heading text-display mt-[var(--space-6)] font-semibold tracking-tight text-foreground">
            {study.title}
          </h1>
          <p className="text-muted-foreground mt-[var(--space-4)] text-body-lg leading-relaxed">{study.dek}</p>

          {/* Wave 15 — signals the page is maintained (not a stale
              write-once artifact) and helps a skimmer decide whether to
              read now or bookmark. lastUpdated is derived from the source
              file's own git history (lib/last-updated.ts) — never
              hand-typed, so it can't silently go stale; renders nothing if
              git history isn't available (fail-soft, same convention as
              every other derived value on this site). */}
          <p className="text-muted-foreground mt-[var(--space-3)] font-mono text-caption">
            {lastUpdated && <>Last updated {lastUpdated} · </>}
            {readingMinutes} min read
          </p>

          {(product?.techChips?.length ?? 0) > 0 && (
            <p className="mt-[var(--space-5)] flex flex-wrap gap-[var(--space-2)]">
              {product?.techChips?.map((chip) => (
                <span
                  key={chip}
                  className="border-border/40 text-muted-foreground rounded-full border px-[var(--space-3)] py-[var(--space-1)] font-mono text-caption"
                >
                  {chip}
                </span>
              ))}
            </p>
          )}

          {/* Design-review (wave 12): one primary action per surface — the
              first link (the live/try destination, or the repo when that's
              all there is) carries the filled variant. */}
          <p className="mt-[var(--space-6)] flex flex-wrap gap-[var(--space-3)]">
            {study.links.map((link, i) => (
              <LinkButton
                key={link.href}
                href={link.href}
                variant={i === 0 ? "primary" : "secondary"}
              >
                {link.label} ↗
              </LinkButton>
            ))}
            {/* Wave 16 — printable case study: window.print() needs a client
                boundary, kept as a one-component island (see print-button.tsx).
                Hidden by the print stylesheet itself (no point printing a
                print button). */}
            <PrintButton />
          </p>

          <SectionHeading index={next()} title={SECTION_TITLES.problem} />
          {study.problem.map((paragraph) => (
            <p
              key={paragraph.slice(0, 32)}
              className="text-muted-foreground mt-[var(--space-4)] text-base leading-relaxed"
            >
              {paragraph}
            </p>
          ))}

          <SectionHeading index={next()} title={SECTION_TITLES.approach} />
          {study.approach.map((paragraph) => (
            <p
              key={paragraph.slice(0, 32)}
              className="text-muted-foreground mt-[var(--space-4)] text-base leading-relaxed"
            >
              {paragraph}
            </p>
          ))}

          {study.architecture && (
            <>
              <SectionHeading index={next()} title={SECTION_TITLES.architecture} />
              {study.architecture.intro && (
                <p className="text-muted-foreground mt-[var(--space-4)] text-base leading-relaxed">
                  {study.architecture.intro}
                </p>
              )}
              <div className="mt-[var(--space-6)]">
                <FlowDiagram
                  stages={study.architecture.stages}
                  label={`${study.title} architecture diagram`}
                />
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
              <SectionHeading index={next()} title={SECTION_TITLES.decisions} />
              <ol className="mt-[var(--space-4)] flex flex-col gap-[var(--space-6)]">
                {study.decisions?.map((decision) => (
                  <li key={decision.sourceRef} className="border-border/40 border-l-2 pl-5">
                    <p className="font-medium text-foreground">{decision.title}</p>
                    <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                      {decision.body}
                    </p>
                  </li>
                ))}
              </ol>
            </>
          )}

          {study.diagram && (
            <>
              <SectionHeading index={next()} title={study.diagram.title} />
              <div className="mt-[var(--space-6)]">
                <StepCurve
                  points={study.diagram.points}
                  unit={study.diagram.unit}
                  label={study.diagram.title}
                />
              </div>
              <p className="text-muted-foreground mt-[var(--space-4)] text-sm leading-relaxed">
                {study.diagram.caption}
              </p>
            </>
          )}

          {(study.results?.length ?? 0) > 0 && (
            <>
              <SectionHeading index={next()} title={SECTION_TITLES.results} />
              <dl className="case-results">
                {study.results?.map((result) => {
                  const provenance = getProvenance(result.sourceRef, product?.repoUrl, study.verifiedAt);
                  return (
                    <div
                      key={result.sourceRef + result.label}
                      className="case-result"
                    >
                      <dd className="case-result-value">
                        <MetricProvenance info={provenance} label={result.label}>
                          {result.value}
                        </MetricProvenance>
                      </dd>
                      <dt className="case-result-label">
                        {result.label}
                        {result.detail && (
                          <span className="text-muted-foreground/80"> · {result.detail}</span>
                        )}
                      </dt>
                    </div>
                  );
                })}
              </dl>
            </>
          )}

          {study.story && (
            <>
              <SectionHeading index={next()} title={study.story.title} />
              {study.story.leadIn && (
                <p className="text-muted-foreground mt-[var(--space-4)] text-base leading-relaxed">
                  {study.story.leadIn.text}
                </p>
              )}
              {study.story.body.map((paragraph) => {
                const text = typeof paragraph === "string" ? paragraph : paragraph.text;
                return (
                  <p
                    key={text.slice(0, 32)}
                    className="text-muted-foreground mt-[var(--space-4)] text-base leading-relaxed"
                  >
                    {text}
                  </p>
                );
              })}
            </>
          )}

          {demo}

          {(study.closing?.length ?? 0) > 0 && (
            <>
              <SectionHeading
                index={next()}
                title={SECTION_TITLES.closing}
              />
              {study.closing?.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 32)}
                  className="text-muted-foreground mt-[var(--space-4)] text-base leading-relaxed"
                >
                  {paragraph}
                </p>
              ))}
            </>
          )}

          {/* Wave 15 — "Work with me": a client/hiring-manager reading this
              far into a case study is the highest-intent visitor on the
              site and previously had no conversion path here (only the
              generic project links below, and Contact at the very bottom
              of the homepage). Same copy register as components/sections/
              contact.tsx, so it reads as one voice, not a bolted-on ad. */}
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

          <div className="border-border/40 mt-[var(--space-10)] flex flex-col items-center gap-[var(--space-5)] border-t pt-[var(--space-10)] text-center">
            <p className="text-muted-foreground text-sm">Want to see it for yourself?</p>
            <p className="flex flex-wrap justify-center gap-[var(--space-3)]">
              {study.links.map((link, i) => (
                <LinkButton
                  key={link.href}
                  href={link.href}
                  variant={i === 0 ? "primary" : "secondary"}
                >
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

        <aside className="print-hide hidden lg:block">
          <div className="sticky top-20 flex flex-col gap-8 pt-[var(--space-16)]">
            <nav aria-label="On this page">
              <h2 className="text-muted-foreground font-mono text-caption tracking-eyebrow uppercase">
                On this page
              </h2>
              {/* The rail. Server-rendered and complete before any script
                  runs, so the section list is linkable with JavaScript off;
                  components/case-study-rail.tsx only marks which entry you
                  are currently inside and fills the track behind it. */}
              <ol data-case-rail className="case-rail">
                {tocSections.map((title) => (
                  <li key={title} data-rail-item={headingId(title)} className="case-rail-item">
                    <a href={`#${headingId(title)}`} className="case-rail-link">
                      {title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            {product?.metric && (
              <div className="border-border/40 rounded-xl border p-[var(--space-5)]">
                <p className="font-mono text-base font-medium text-foreground">
                  {product.metric.value}
                </p>
                <p className="text-muted-foreground mt-1.5 text-caption leading-snug">
                  {product.metric.label}
                </p>
              </div>
            )}

            <p className="flex flex-col gap-[var(--space-2-5)] text-sm">
              {study.links.map((link) => (
                <InlineLink key={link.href} href={link.href} className="w-fit">
                  {link.label} ↗
                </InlineLink>
              ))}
            </p>

            {/* Wave 16 — related projects, derived from shared categories
                (lib/related-products.ts); omitted entirely when a case
                study shares no category with anything else, rather than
                rendering an empty heading. */}
            {related.length > 0 && (
              <div>
                <h2 className="text-muted-foreground font-mono text-caption tracking-eyebrow uppercase">
                  Related projects
                </h2>
                <ul className="mt-[var(--space-3)] flex flex-col gap-[var(--space-3)]">
                  {related.map(({ product: relatedProduct, sharedCategories }) => (
                    <li key={relatedProduct.slug}>
                      <Link
                        href={`/work/${relatedProduct.slug}`}
                        className="focus-visible:outline-ring text-foreground block text-sm font-medium transition-colors duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                      >
                        {relatedProduct.name}
                      </Link>
                      <p className="mt-[var(--space-1)] flex flex-wrap gap-[var(--space-1-5)]">
                        {sharedCategories.map((categoryId) => (
                          <span
                            key={categoryId}
                            className="border-border/40 text-muted-foreground rounded-full border px-2 py-[var(--space-0-5)] font-mono text-caption"
                          >
                            {CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId}
                          </span>
                        ))}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Renders nothing. Drives the rail by attribute so the markup
          above stays server-rendered and complete. */}
      <CaseStudyRail headingIds={tocSections.map(headingId)} />
    </main>
  );
}
