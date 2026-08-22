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
 * CONCEPT B — "the calm article": case studies are deliberately NOT made to
 * look like the homepage. Fourteen pages carry most of the reading time on
 * this site, and a centered-editorial, card-grid language that reads well
 * for a landing page gets tiring across long technical prose. This
 * direction keeps the homepage and /projects exactly as they are, and gives
 * the case study its own, quieter, single-column reading mode: a narrow
 * measure even on a wide monitor, no sidebar, no boxed "on this page" nav,
 * no eyebrow labels or eval-table chrome — structure carried by whitespace
 * and a quiet type change alone, the way a well-set essay reads.
 */

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 id={headingId(title)} data-case-heading className="case-heading-article">
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
  related?: RelatedProduct[];
}) {
  const lastUpdated = getCaseStudyLastUpdated(study.slug);
  const readingMinutes = caseStudyReadingMinutes(study);

  return (
    <main
      id="main"
      data-case-study
      style={{ "--case-hue": String(projectHue(allProducts, study.slug)) } as React.CSSProperties}
      className="case-study-article mx-auto w-full max-w-2xl flex-1 px-[var(--space-6)] pt-[var(--space-14)] pb-[var(--space-24)] md:pt-[var(--space-20)]"
    >
      <div aria-hidden="true" className="reading-progress" />

      <p className="text-muted-foreground text-sm">
        <Link
          href="/projects"
          className="focus-visible:outline-ring -my-2.5 inline-flex min-h-11 items-center transition-colors duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          ← All projects
        </Link>
      </p>

      <h1 className="font-heading text-heading mt-[var(--space-5)] font-semibold tracking-tight text-foreground">
        {study.title}
      </h1>
      <p className="text-muted-foreground mt-[var(--space-3)] text-body-lg leading-relaxed">{study.dek}</p>

      <p className="text-muted-foreground mt-[var(--space-4)] text-sm">
        {lastUpdated && <>Updated {lastUpdated} · </>}
        {readingMinutes} min read
        {(product?.techChips?.length ?? 0) > 0 && <> · Built with {product?.techChips?.join(", ")}</>}
      </p>

      <p className="mt-[var(--space-5)] flex flex-wrap gap-[var(--space-3)]">
        {study.links.map((link, i) => (
          <LinkButton key={link.href} href={link.href} variant={i === 0 ? "primary" : "secondary"}>
            {link.label} ↗
          </LinkButton>
        ))}
        <PrintButton />
      </p>

      <div data-case-article className="case-article-body min-w-0">
        <SectionHeading title={SECTION_TITLES.problem} />
        {study.problem.map((paragraph) => (
          <p key={paragraph.slice(0, 32)} className="case-article-p">
            {paragraph}
          </p>
        ))}

        <SectionHeading title={SECTION_TITLES.approach} />
        {study.approach.map((paragraph) => (
          <p key={paragraph.slice(0, 32)} className="case-article-p">
            {paragraph}
          </p>
        ))}

        {study.architecture && (
          <>
            <SectionHeading title={SECTION_TITLES.architecture} />
            {study.architecture.intro && <p className="case-article-p">{study.architecture.intro}</p>}
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
            {study.decisions?.map((decision) => (
              <p key={decision.sourceRef} className="case-article-p">
                <em className="case-article-decision-lead">{decision.title}.</em> {decision.body}
              </p>
            ))}
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
            <dl className="case-results-article">
              {study.results?.map((result) => {
                const provenance = getProvenance(result.sourceRef, product?.repoUrl, study.verifiedAt);
                return (
                  <div key={result.sourceRef + result.label} className="case-result-article relative">
                    <dt className="case-result-article-label">{result.label}</dt>
                    <dd className="case-result-article-value" data-format={result.format ?? "stat"}>
                      <MetricProvenance info={provenance} label={result.label} selfAnchor={false}>
                        {result.value}
                      </MetricProvenance>
                      {result.detail && (
                        <span className="case-result-article-detail"> — {result.detail}</span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </>
        )}

        {study.story && (
          <>
            <SectionHeading title={study.story.title} />
            {study.story.leadIn && <p className="case-article-p">{study.story.leadIn.text}</p>}
            {study.story.body.map((paragraph) => {
              const text = typeof paragraph === "string" ? paragraph : paragraph.text;
              return (
                <p key={text.slice(0, 32)} className="case-article-p">
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
              <p key={paragraph.slice(0, 32)} className="case-article-p">
                {paragraph}
              </p>
            ))}
          </>
        )}

        <p className="case-article-p print-hide">
          <em>Building something like this?</em> {availability.summary}{" "}
          <a href={`mailto:${site.email}`} className="case-article-link">
            Email me ↗
          </a>{" "}
          or{" "}
          <a href={site.resumeUrl} className="case-article-link">
            view my resume ↗
          </a>
          .
        </p>

        {related.length > 0 && (
          <p className="text-muted-foreground print-hide mt-[var(--space-10)] text-sm leading-relaxed">
            Related:{" "}
            {related.map(({ product: relatedProduct }, i) => (
              <span key={relatedProduct.slug}>
                {i > 0 && ", "}
                <Link href={`/work/${relatedProduct.slug}`} className="case-article-link">
                  {relatedProduct.name}
                </Link>
              </span>
            ))}
            .
          </p>
        )}

        <p className="text-muted-foreground mt-[var(--space-6)] border-t border-border/40 pt-[var(--space-6)] text-sm">
          <Link href="/projects" className="case-article-link">
            ← Back to all projects
          </Link>
        </p>
      </div>
    </main>
  );
}
