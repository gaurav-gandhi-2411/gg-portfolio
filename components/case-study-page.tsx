import { FlowDiagram } from "@/components/flow-diagram";
import { InlineLink } from "@/components/inline-link";
import { LinkButton } from "@/components/link-button";
import { TransitionLink } from "@/components/transition-link";
import type { CaseStudy, Product } from "@/content/types";

/**
 * Wave 12 — the /work/[slug] case-study template: numbered sections, one
 * idea per section, novice-readable, everything server-rendered; `demo`
 * is the one interactive slot injected by the route.
 *
 * Wave 13 — desktop composition (GG's standing 1280–1600px complaint):
 * at xl the page becomes content column + sticky right rail (on-this-page
 * anchors, the headline metric, project links) so the case study reads
 * like a documented spread instead of a strand in a void. Below xl the
 * wave-12 single column is unchanged. The h1 carries the same
 * view-transition-name as its project-card title, so supporting browsers
 * morph the clicked title into the page heading; a scroll-driven reading
 * progress bar (pure CSS, @supports-gated) sits above the nav.
 */

function headingId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function SectionHeading({ index, title }: { index: number; title: string }) {
  return (
    <h2
      id={headingId(title)}
      className="font-heading text-title mt-14 flex scroll-mt-24 items-baseline gap-4 font-semibold text-foreground"
    >
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
  const tocSections: string[] = [
    "The problem",
    "How it works",
    ...(study.architecture ? ["Architecture"] : []),
    ...((study.decisions?.length ?? 0) > 0 ? ["Key decisions — and why"] : []),
    ...((study.results?.length ?? 0) > 0 ? ["Results — the honest numbers"] : []),
    ...(study.story ? [study.story.title] : []),
    ...((study.closing?.length ?? 0) > 0 ? ["What this means if you need something similar"] : []),
  ];
  let sectionIndex = 0;
  const next = () => ++sectionIndex;

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-2xl flex-1 px-6 pt-12 pb-20 md:pt-16 xl:max-w-5xl"
    >
      <div aria-hidden="true" className="reading-progress" />

      <div className="xl:grid xl:grid-cols-[minmax(0,42rem)_15rem] xl:justify-between xl:gap-x-12">
        <div className="min-w-0">
          <p className="text-muted-foreground font-mono text-xs tracking-eyebrow uppercase">
            <TransitionLink
              href="/projects"
              className="focus-visible:outline-ring transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
            >
              ← All projects
            </TransitionLink>
          </p>

          <h1
            className="font-heading text-display mt-6 font-semibold tracking-tight text-foreground"
            style={{ viewTransitionName: `vt-title-${study.slug}` }}
          >
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

          {/* Design-review (wave 12): one primary action per surface — the
              first link (the live/try destination, or the repo when that's
              all there is) carries the filled variant. */}
          <p className="mt-6 flex flex-wrap gap-3">
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

          {(study.closing?.length ?? 0) > 0 && (
            <>
              <SectionHeading
                index={next()}
                title="What this means if you need something similar"
              />
              {study.closing?.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 32)}
                  className="text-muted-foreground mt-4 text-base leading-relaxed"
                >
                  {paragraph}
                </p>
              ))}
            </>
          )}

          <div className="border-border/40 mt-16 flex flex-col items-center gap-5 border-t pt-10 text-center">
            <p className="text-muted-foreground text-sm">Want to see it for yourself?</p>
            <p className="flex flex-wrap justify-center gap-3">
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
            <TransitionLink
              href="/projects"
              className="text-accent focus-visible:outline-ring text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
            >
              ← Back to all projects
            </TransitionLink>
          </div>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-20 flex flex-col gap-8 pt-16">
            <nav aria-label="On this page">
              <h2 className="text-muted-foreground font-mono text-xs tracking-eyebrow uppercase">
                On this page
              </h2>
              <ol className="border-border/40 mt-3 flex flex-col gap-1.5 border-l">
                {tocSections.map((title) => (
                  <li key={title}>
                    <a
                      href={`#${headingId(title)}`}
                      className="text-muted-foreground focus-visible:outline-ring block py-0.5 pl-4 text-sm leading-snug transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                    >
                      {title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            {product?.metric && (
              <div className="border-border/40 rounded-xl border p-5">
                <p className="font-mono text-base font-medium text-foreground">
                  {product.metric.value}
                </p>
                <p className="text-muted-foreground mt-1.5 text-xs leading-snug">
                  {product.metric.label}
                </p>
              </div>
            )}

            <p className="flex flex-col gap-2.5 text-sm">
              {study.links.map((link) => (
                <InlineLink key={link.href} href={link.href} className="w-fit">
                  {link.label} ↗
                </InlineLink>
              ))}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
