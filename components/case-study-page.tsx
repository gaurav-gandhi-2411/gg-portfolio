import Link from "next/link";
import { FlowDiagram } from "@/components/flow-diagram";
import { LinkButton } from "@/components/link-button";
import { MetricProvenance } from "@/components/metric-provenance";
import { PrintButton } from "@/components/print-button";
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
 * CONCEPT A — "editorial extends": the case study is built from the same
 * pieces the homepage and /projects already use — a centered wide column,
 * no persistent sidebar, results as big display-numeral stats, decisions as
 * bordered cards, related projects as a small card row — so arriving here
 * from a project card feels like continuing the same piece of work rather
 * than switching into a different product.
 */

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 id={headingId(title)} data-case-heading className="case-heading-editorial">
      {title}
      <span aria-hidden="true" className="case-heading-editorial-rule" />
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
  related?: RelatedProduct[];
}) {
  const lastUpdated = getCaseStudyLastUpdated(study.slug);
  const readingMinutes = caseStudyReadingMinutes(study);

  return (
    <main
      id="main"
      data-case-study
      style={{ "--case-hue": String(projectHue(allProducts, study.slug)) } as React.CSSProperties}
      className="case-study-editorial mx-auto w-full max-w-3xl flex-1 px-[var(--space-6)] pt-[var(--space-12)] pb-[var(--space-24)] md:pt-[var(--space-16)] lg:max-w-4xl"
    >
      <div aria-hidden="true" className="reading-progress" />
      <div aria-hidden="true" className="case-opening-wash" />

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
      <p className="text-muted-foreground mt-[var(--space-4)] max-w-measure text-body-lg leading-relaxed">
        {study.dek}
      </p>

      {/* The byline row — everything that used to live in a persistent
          sidebar (freshness, tech, the headline metric) sits once, near the
          top, the way a magazine feature's masthead line carries its own
          metadata instead of a permanent margin column following the
          reader down the page. */}
      <div className="case-byline">
        <span>
          {lastUpdated && <>Updated {lastUpdated} · </>}
          {readingMinutes} min read
        </span>
        {product?.metric && (
          <span className="case-byline-metric">
            <MetricProvenance
              info={getProvenance(product.metric.sourceRef, product?.repoUrl, study.verifiedAt)}
              label={product.metric.label}
            >
              {product.metric.value}
            </MetricProvenance>{" "}
            <span className="text-muted-foreground">{product.metric.label}</span>
          </span>
        )}
      </div>

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

      <p className="mt-[var(--space-6)] flex flex-wrap gap-[var(--space-3)]">
        {study.links.map((link, i) => (
          <LinkButton key={link.href} href={link.href} variant={i === 0 ? "primary" : "secondary"}>
            {link.label} ↗
          </LinkButton>
        ))}
        <PrintButton />
      </p>

      <div data-case-article className="min-w-0">
        <SectionHeading title={SECTION_TITLES.problem} />
        {study.problem.map((paragraph) => (
          <p key={paragraph.slice(0, 32)} className="text-muted-foreground mt-[var(--space-4)] max-w-measure text-base leading-relaxed">
            {paragraph}
          </p>
        ))}

        <SectionHeading title={SECTION_TITLES.approach} />
        {study.approach.map((paragraph) => (
          <p key={paragraph.slice(0, 32)} className="text-muted-foreground mt-[var(--space-4)] max-w-measure text-base leading-relaxed">
            {paragraph}
          </p>
        ))}

        {study.architecture && (
          <>
            <SectionHeading title={SECTION_TITLES.architecture} />
            {study.architecture.intro && (
              <p className="text-muted-foreground mt-[var(--space-4)] max-w-measure text-base leading-relaxed">
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
            <ol className="case-decisions">
              {study.decisions?.map((decision) => (
                <li key={decision.sourceRef} className="case-decision-card">
                  <p className="font-heading text-lead font-semibold text-foreground">{decision.title}</p>
                  <p className="text-muted-foreground mt-[var(--space-2)] text-sm leading-relaxed">{decision.body}</p>
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
            <dl className="case-results-editorial">
              {study.results?.map((result) => {
                const provenance = getProvenance(result.sourceRef, product?.repoUrl, study.verifiedAt);
                return (
                  <div key={result.sourceRef + result.label} className="case-result-editorial relative">
                    <dd className="case-result-editorial-value" data-format={result.format ?? "stat"}>
                      <MetricProvenance info={provenance} label={result.label} selfAnchor={false}>
                        {result.value}
                      </MetricProvenance>
                    </dd>
                    <dt className="case-result-editorial-label">
                      {result.label}
                      {result.detail && <span className="text-muted-foreground/80"> · {result.detail}</span>}
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
              <p className="text-muted-foreground mt-[var(--space-4)] max-w-measure text-base leading-relaxed">
                {study.story.leadIn.text}
              </p>
            )}
            {study.story.body.map((paragraph) => {
              const text = typeof paragraph === "string" ? paragraph : paragraph.text;
              return (
                <p key={text.slice(0, 32)} className="text-muted-foreground mt-[var(--space-4)] max-w-measure text-base leading-relaxed">
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
              <p key={paragraph.slice(0, 32)} className="text-muted-foreground mt-[var(--space-4)] max-w-measure text-base leading-relaxed">
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
          <div className="print-hide mt-[var(--space-16)]">
            <h2 className="text-muted-foreground text-center font-mono text-caption tracking-eyebrow uppercase">
              Related projects
            </h2>
            <ul className="case-related-row">
              {related.map(({ product: relatedProduct }) => (
                <li key={relatedProduct.slug} className="case-related-card">
                  <Link
                    href={`/work/${relatedProduct.slug}`}
                    className="focus-visible:outline-ring text-foreground block font-heading text-lead font-semibold transition-colors duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                  >
                    {relatedProduct.name}
                  </Link>
                  <p className="text-muted-foreground mt-[var(--space-1)] line-clamp-2 text-caption leading-snug">
                    {relatedProduct.tagline}
                  </p>
                </li>
              ))}
            </ul>
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
