import Link from "next/link";
import { FlowDiagram } from "@/components/flow-diagram";
import { LinkButton } from "@/components/link-button";
import type { CaseStudy, Product } from "@/content/types";

/**
 * Wave 12 — the /work/[slug] case-study template. Structure follows the
 * maninder case-study pattern (numbered sections, one idea per section)
 * with GG's teaching brief: a novice should leave understanding the
 * problem, the approach, the architecture, why each model/method was
 * chosen, and what the honest results are. Everything server-rendered;
 * `demo` is the one interactive slot (Warmer's heat toy, TriageIQ's
 * classifier), injected by the route.
 */

function SectionHeading({ index, title }: { index: number; title: string }) {
  return (
    <h2 className="font-heading text-title mt-14 flex items-baseline gap-4 font-semibold text-foreground">
      <span aria-hidden="true" className="text-accent font-mono text-sm font-medium">
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
}: {
  study: CaseStudy;
  product: Product | undefined;
  demo?: React.ReactNode;
}) {
  let sectionIndex = 0;
  const next = () => ++sectionIndex;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 pt-12 pb-20 md:pt-16">
      <p className="text-muted-foreground font-mono text-xs tracking-eyebrow uppercase">
        <Link
          href="/projects"
          className="focus-visible:outline-ring transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          ← All projects
        </Link>
      </p>

      <h1 className="font-heading text-display mt-6 font-semibold tracking-tight text-foreground">
        {study.title}
      </h1>
      <p className="text-muted-foreground mt-4 text-lg leading-relaxed">{study.dek}</p>

      {(product?.techChips?.length ?? 0) > 0 && (
        <p className="mt-5 flex flex-wrap gap-2">
          {product?.techChips?.map((chip) => (
            <span
              key={chip}
              className="border-border/40 text-muted-foreground rounded-full border px-3 py-1 font-mono text-xs"
            >
              {chip}
            </span>
          ))}
        </p>
      )}

      <p className="mt-6 flex flex-wrap gap-3">
        {study.links.map((link) => (
          <LinkButton key={link.href} href={link.href}>
            {link.label} ↗
          </LinkButton>
        ))}
      </p>

      <SectionHeading index={next()} title="The problem" />
      {study.problem.map((paragraph) => (
        <p
          key={paragraph.slice(0, 32)}
          className="text-muted-foreground mt-4 text-base leading-relaxed"
        >
          {paragraph}
        </p>
      ))}

      <SectionHeading index={next()} title="How it works" />
      {study.approach.map((paragraph) => (
        <p
          key={paragraph.slice(0, 32)}
          className="text-muted-foreground mt-4 text-base leading-relaxed"
        >
          {paragraph}
        </p>
      ))}

      {study.architecture && (
        <>
          <SectionHeading index={next()} title="Architecture" />
          {study.architecture.intro && (
            <p className="text-muted-foreground mt-4 text-base leading-relaxed">
              {study.architecture.intro}
            </p>
          )}
          <div className="mt-6">
            <FlowDiagram
              stages={study.architecture.stages}
              label={`${study.title} architecture diagram`}
            />
          </div>
          {study.architecture.note && (
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              {study.architecture.note}
            </p>
          )}
        </>
      )}

      {(study.decisions?.length ?? 0) > 0 && (
        <>
          <SectionHeading index={next()} title="Key decisions — and why" />
          <ol className="mt-4 flex flex-col gap-6">
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

      {(study.results?.length ?? 0) > 0 && (
        <>
          <SectionHeading index={next()} title="Results — the honest numbers" />
          <dl className="mt-4 flex flex-col">
            {study.results?.map((result) => (
              <div
                key={result.sourceRef + result.label}
                className="border-border/30 flex flex-col gap-1 border-b py-4 first:pt-0 last:border-b-0"
              >
                <dd className="font-mono text-base font-medium text-foreground">
                  {result.value}
                </dd>
                <dt className="text-muted-foreground text-sm leading-relaxed">
                  {result.label}
                  {result.detail && (
                    <span className="text-muted-foreground/80"> — {result.detail}</span>
                  )}
                </dt>
              </div>
            ))}
          </dl>
        </>
      )}

      {study.story && (
        <>
          <SectionHeading index={next()} title={study.story.title} />
          {study.story.body.map((paragraph) => (
            <p
              key={paragraph.slice(0, 32)}
              className="text-muted-foreground mt-4 text-base leading-relaxed"
            >
              {paragraph}
            </p>
          ))}
        </>
      )}

      {demo}

      <div className="border-border/40 mt-16 flex flex-col items-center gap-5 border-t pt-10 text-center">
        <p className="text-muted-foreground text-sm">Want to see it for yourself?</p>
        <p className="flex flex-wrap justify-center gap-3">
          {study.links.map((link) => (
            <LinkButton key={link.href} href={link.href}>
              {link.label} ↗
            </LinkButton>
          ))}
        </p>
        <Link
          href="/projects"
          className="text-accent focus-visible:outline-ring text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          ← Back to all projects
        </Link>
      </div>
    </main>
  );
}
