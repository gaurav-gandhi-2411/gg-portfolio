import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseStudyPage } from "@/components/case-study-page";
import { HeatToyShell } from "@/components/heat-toy-shell";
import { TriageiqClassifyDisclosure } from "@/components/triageiq-classify-disclosure";
import { caseStudies } from "@/content/case-studies";
import { products } from "@/content/products";
import { getWarmerPuzzleNumber } from "@/lib/live-data";

export function generateStaticParams() {
  return Object.keys(caseStudies).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const study = caseStudies[slug];
  if (!study) return {};
  return {
    title: `${study.title} — case study — Gaurav Gandhi`,
    description: study.dek,
  };
}

/**
 * Wave 12 — one case-study page per project. The two products with live
 * in-browser demos get them embedded right where the teaching happens:
 * Warmer's actual matching engine, TriageIQ's illustrative classifier.
 */
export default async function WorkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const study = caseStudies[slug];
  if (!study) notFound();

  const product = products.find((p) => p.slug === slug);

  let demo: React.ReactNode;
  if (slug === "warmer") {
    const puzzle = await getWarmerPuzzleNumber();
    demo = (
      <section
        aria-label="Try Warmer's matching engine"
        className="border-border/40 mt-16 flex flex-col gap-4 border-t pt-10"
      >
        <p className="text-muted-foreground text-xs tracking-eyebrow uppercase">
          Try the engine
          {puzzle ? (
            <span className="font-mono normal-case tracking-normal">
              {" "}
              — puzzle #{puzzle.number} today
            </span>
          ) : null}
        </p>
        <p className="max-w-measure text-base leading-relaxed text-foreground">
          I&apos;ve hidden one word. Type a guess and I&apos;ll tell you how close you are —
          this is the exact matching engine described above, shown as an actual
          embedding-space plot.
        </p>
        <HeatToyShell />
      </section>
    );
  } else if (slug === "triageiq") {
    demo = (
      <section
        aria-label="Try an illustrative TriageIQ classifier"
        className="border-border/40 mt-16 flex flex-col gap-2 border-t pt-10"
      >
        <p className="text-muted-foreground text-xs tracking-eyebrow uppercase">Try it</p>
        <p className="max-w-measure text-base leading-relaxed text-foreground">
          The same technique as stage 1, running live in your browser on a small sample of
          real GitHub issues:
        </p>
        <TriageiqClassifyDisclosure />
      </section>
    );
  }

  return <CaseStudyPage study={study} product={product} demo={demo} />;
}
