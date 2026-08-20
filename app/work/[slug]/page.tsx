import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PowerGridFrame } from "@/components/adk-tracegauge/power-grid-frame";
import { PowerGridStatic } from "@/components/adk-tracegauge/power-grid-static";
import { CaseStudyPage } from "@/components/case-study-page";
import { HeatToyShell } from "@/components/heat-toy-shell";
import { CaseStudyJsonLd } from "@/components/json-ld";
import { RetrievalResults } from "@/components/triageiq/retrieval-results";
import { RetrievalSpaceFrame } from "@/components/triageiq/retrieval-space";
import { TriageiqClassifyDisclosure } from "@/components/triageiq-classify-disclosure";
import { EmbeddingViewerFrame } from "@/components/warmer/embedding-viewer-frame";
import { EmbeddingViewerStatic } from "@/components/warmer/embedding-viewer-static";
import { caseStudies } from "@/content/case-studies";
import { products } from "@/content/products";
import { getEmbeddingProjection } from "@/lib/embedding-projection";
import { getWarmerPuzzleNumber } from "@/lib/live-data";
import { getRetrievalProjection } from "@/lib/triageiq-retrieval";
import { relatedProducts } from "@/lib/related-products";

export function generateStaticParams() {
  return Object.keys(caseStudies).map((slug) => ({ slug }));
}

// Wave 20 — SEO/social metadata audit. Two bugs found across all 13 case
// studies, not just the ones spot-checked: (1) every `dek` here is a single
// on-page sentence (186-302 chars) used verbatim as the meta description,
// blowing the ~155-char budget on every case study but tracegauge; (2)
// generateMetadata only ever set `title`/`description` — with no explicit
// `openGraph`/`twitter` block, Next's metadata merging does NOT derive those
// from title/description per route, it carries the ROOT layout's openGraph/
// twitter object over unchanged. So sharing any /work/[slug] link on
// LinkedIn/X/Slack previewed as the generic homepage identity, never the
// project. wordTrunc/truncateAtBoundary fix both mechanically (no new copy
// invented — same sourced sentence, cut at a clause or word boundary) so
// every case study is covered, not just the two audited here.
function wordTrunc(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen - 1);
  const lastSpace = truncated.lastIndexOf(" ");
  const safe = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return `${safe.replace(/[,;:\s]+$/, "")}…`;
}

function truncateAtBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const clauses = text.split(" · ");
  let result = clauses[0];
  if (result.length > maxLen) return wordTrunc(result, maxLen);
  for (const clause of clauses.slice(1)) {
    const candidate = `${result} · ${clause}`;
    if (candidate.length <= maxLen) {
      result = candidate;
      continue;
    }
    const remaining = maxLen - result.length - 3;
    if (remaining > 20) {
      result = `${result} · ${wordTrunc(clause, remaining)}`;
    }
    break;
  }
  return result;
}

const META_DESCRIPTION_MAX = 155;
const TITLE_MAX = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const study = caseStudies[slug];
  if (!study) return {};
  const title = wordTrunc(`${study.title} · case study · Gaurav Gandhi`, TITLE_MAX);
  const description = truncateAtBoundary(study.dek, META_DESCRIPTION_MAX);
  return {
    title,
    description,
    // F3 — canonical tag per case study.
    alternates: { canonical: `/work/${slug}` },
    // Next's metadata merging replaces the whole openGraph/twitter object
    // per segment rather than merging individual fields — omitting
    // siteName/type/card here would silently drop them (they'd fall back to
    // nothing, not to the root layout's values) rather than inherit them.
    openGraph: { title, description, siteName: "Gaurav Gandhi", type: "website" },
    twitter: { card: "summary_large_image", title, description },
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
  const related = product ? relatedProducts(product, products) : [];

  let demo: React.ReactNode;
  if (slug === "warmer") {
    const puzzle = await getWarmerPuzzleNumber();
    const projection = getEmbeddingProjection();
    demo = (
      <>
        <section
          aria-label="The fix, made visible"
          className="border-border/40 mt-16 flex flex-col gap-4 border-t pt-10"
        >
          <p className="text-muted-foreground text-xs tracking-eyebrow uppercase">
            The fix, made visible
          </p>
          <p className="max-w-measure text-base leading-relaxed text-foreground">
            Real embeddings for the {projection.n_terms} actual terms from the eval above,
            projected via t-SNE. Switch between the base model and the fine-tune to see the
            same terms rearrange; hover or tap any point to see its term.
          </p>
          {/*
            This paragraph exists because the measurement contradicted the
            story the picture tells. Shipping the viewer without it would
            have let a t-SNE layout stand in as evidence for a claim the
            silhouette control does not support.
          */}
          <p className="max-w-measure text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">What this does and does not show.</span>{" "}
            The fine-tune&apos;s result is the eval metric above, which measures the task it was
            trained for. Cluster separation is a weaker claim, and it does not survive checking:
            mean silhouette on the raw embeddings is 9.3× better for the fine-tune only when both
            models are scored on the fine-tune&apos;s own clusters. Give each model its own
            clusters and the base model scores higher (0.037 vs 0.025). Both numbers sit near
            zero. So the tighter base-model cloud you see here is largely t-SNE&apos;s layout, not
            a property of the embedding space. Fine-tuning reorganised that space rather than
            sharpening it.
          </p>
          <EmbeddingViewerFrame>
            <EmbeddingViewerStatic points={projection.points} />
          </EmbeddingViewerFrame>
        </section>
        <section
          aria-label="Try Warmer's matching engine"
          className="border-border/40 mt-16 flex flex-col gap-4 border-t pt-10"
        >
          <p className="text-muted-foreground text-xs tracking-eyebrow uppercase">
            Try the engine
            {puzzle ? (
              <span className="font-mono normal-case tracking-normal">
                {" "}
                · puzzle #{puzzle.number} today
              </span>
            ) : null}
          </p>
          <p className="max-w-measure text-base leading-relaxed text-foreground">
            I&apos;ve hidden one word. Type a guess and I&apos;ll tell you how close you are.
            this is the exact matching engine described above, shown as an actual
            embedding-space plot.
          </p>
          <HeatToyShell />
        </section>
      </>
    );
  } else if (slug === "triageiq") {
    const retrieval = getRetrievalProjection();
    demo = (
      <>
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

        <section
          aria-label="Which already-solved issues look like this one"
          className="border-border/40 mt-16 flex flex-col gap-4 border-t pt-10"
        >
          <p className="text-muted-foreground text-xs tracking-eyebrow uppercase">
            The second question, in the space it is answered in
          </p>
          <p className="max-w-measure text-base leading-relaxed text-foreground">
            {retrieval.corpus_size} real {retrieval.repo} issues, embedded by the model this
            project actually ships and laid out in three dimensions. Pick one of the six and
            you see the five issues the retriever handed back for it, in its order, with the
            one the gold set calls related marked wherever it came in.
          </p>
          {/*
            The caveat sits above the picture, not under it. A point cloud is
            persuasive on its own terms and this one would happily be read as
            saying "related issues sit next to each other", which is a claim
            about the picture rather than about the retriever.
          */}
          <p className="max-w-measure text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              What the picture is, and what it is not.
            </span>{" "}
            Every rank here was worked out in the model&apos;s own 768 dimensions before
            anything was drawn. What you see is a t-SNE layout, which is a flattening chosen to
            look tidy, so two dots sitting together are not necessarily each other&apos;s
            nearest neighbours and a highlighted issue can land anywhere on screen. That is why
            the highlight follows issue numbers rather than distance. The corpus is also a
            seed-fixed sample of {retrieval.corpus_size} of the{" "}
            {retrieval.corpus_total.toLocaleString()} issues in the gold set, so these ranks
            describe this sample, and the recall figures above are the ones measured over
            everything.
          </p>
          <RetrievalSpaceFrame>
            {/*
              The no-JavaScript path, and the pre-hydration one: every query's
              real result, server-rendered. The interactive version adds the
              picture and in-place switching, never a number this does not
              already carry.
            */}
            <div className="flex flex-col gap-[var(--space-6)]">
              {retrieval.queries.map((query) => (
                <RetrievalResults key={query.n} query={query} topK={retrieval.top_k} />
              ))}
            </div>
          </RetrievalSpaceFrame>
        </section>
      </>
    );
  } else if (slug === "adk-tracegauge") {
    demo = (
      <section
        aria-label="Power to catch a cost rise, by noise shape and eval-set size"
        className="border-border/40 mt-16 flex flex-col gap-4 border-t pt-10"
      >
        <p className="text-muted-foreground text-xs tracking-eyebrow uppercase">Try it</p>
        <p className="max-w-measure text-base leading-relaxed text-foreground">
          The story above is that one power figure turned out to depend on an assumption nobody
          had named. Pick a noise shape, a variance level, and an eval-set size below, and see
          the same tradeoff the package&apos;s own retraction was built on.
        </p>
        <PowerGridFrame>
          <PowerGridStatic />
        </PowerGridFrame>
      </section>
    );
  }

  return (
    <>
      <CaseStudyJsonLd study={study} product={product} />
      <CaseStudyPage study={study} product={product} demo={demo} related={related} />
    </>
  );
}
