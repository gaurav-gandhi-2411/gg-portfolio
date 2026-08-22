import { InlineLink } from "@/components/inline-link";
import { MetricProvenance } from "@/components/metric-provenance";
import { SearchMethodologyDisclosure } from "@/components/search-methodology-disclosure";
import { getProvenance } from "@/lib/provenance";

/**
 * BL-9 round 5 — a short, honest write-up of how this search box's ranking
 * approach was chosen, rendered directly on /projects next to the box it
 * describes (app/projects/page.tsx).
 *
 * NOT a /work/[slug] case study: content/case-studies/index.ts's own header
 * states its registry keys "match content/products.ts slugs exactly" — this
 * project-search feature searches OVER the products in that list, it
 * isn't an entry in it, so giving it a case-study page would break that
 * documented 1:1 invariant for no real benefit (a visitor can already reach
 * this content from the exact page where the feature lives, which is a
 * shorter path than a separate page would be). A collapsed-by-default
 * disclosure keeps /projects' primary job — browsing the projects — the
 * visually dominant thing on the page; this is deliberately opt-in reading,
 * not a wall of text above the fold.
 *
 * Every number below carries a sourceRef into content/provenance.md's
 * "BL-9 round 5" section, all pointing at this repo's own committed
 * reports/BL-9-round5-static-embedding-and-decision.md (the full comparison,
 * every command, every measurement) and evals/project-search/README.md (the
 * eval's own stated limitations) — same rule-65b sourcing convention as
 * every case-study result, just without a CaseStudy object to hang off of,
 * so getProvenance() is called directly here rather than via
 * case-study-page.tsx's results-row loop.
 */

interface MethodologyRow {
  sourceRef: string;
  label: string;
  value: string;
}

const ROWS: MethodologyRow[] = [
  { sourceRef: "search:decision-keyword", label: "Keyword-only, shipped", value: "0 B, 0ms" },
  {
    sourceRef: "search:decision-static-matrix",
    label: "Self-built static-embedding matrix, built but not shipped",
    value: "427,150 B, 9,570ms",
  },
  {
    sourceRef: "search:decision-potion",
    label: "potion-base-8M (third-party), evaluated but not shipped",
    value: "30,920,426 B, 612,342ms",
  },
  {
    sourceRef: "search:decision-minilm",
    label: "MiniLM, the original tier, removed",
    value: "47,299,486 B, 570,121ms",
  },
];

const VERIFIED_AT = "2026-08-15";

export function SearchMethodology() {
  return (
    <SearchMethodologyDisclosure summary="Search methodology" panelId="search-methodology-panel">
      <div className="max-w-measure text-left">
        <p className="text-muted-foreground text-sm leading-relaxed">
          This box shipped after four build-and-measure rounds tested whether a client-side
          neural embedding model would out-rank simple keyword matching. Four ranking approaches
          were built and measured end-to-end: a real transformer (MiniLM), a third-party
          static-embedding model (potion-base-8M), a static-embedding matrix built from scratch
          specifically to find a middle ground, and the keyword/substring scorer that was already
          shipping for free. Real wire bytes and real cache-disabled, Slow-4G cold starts (not
          estimates):
        </p>

        <dl className="mt-5 flex flex-col">
          {ROWS.map((row) => {
            const provenance = getProvenance(row.sourceRef, undefined, VERIFIED_AT);
            return (
              <div
                key={row.sourceRef}
                className="border-border/30 flex flex-col gap-1 border-b py-3 first:pt-0 last:border-b-0"
              >
                <dd className="font-mono text-sm font-medium text-foreground">
                  <MetricProvenance info={provenance} label={row.label}>
                    {row.value}
                  </MetricProvenance>
                </dd>
                <dt className="text-muted-foreground text-caption leading-relaxed">{row.label}</dt>
              </div>
            );
          })}
        </dl>

        <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
          <MetricProvenance
            info={getProvenance("search:ci-overlap", undefined, VERIFIED_AT)}
            label="statistical indistinguishability finding"
          >
            Every tier&apos;s 95% Wilson confidence interval overlaps every other tier&apos;s, at
            both Recall@1 and Recall@3
          </MetricProvenance>{" "}
          McNemar&apos;s exact test on the two nominal &quot;leaders&quot; (MiniLM vs.
          potion-base-8M) returns p=1.0 at Recall@1 and p=0.5 at Recall@3. At this sample size,
          none of the four approaches is distinguishable from any other on retrieval quality. The
          only variable that did separate them was size and cold-start latency.
        </p>

        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          <MetricProvenance
            info={getProvenance("search:decision-rationale", undefined, VERIFIED_AT)}
            label="the decision rule applied"
          >
            The decision rule: eliminate anything with a multi-minute cold start, then ship the
            smallest option among what&apos;s statistically tied for best
          </MetricProvenance>{" "}
          killed both real models outright (MiniLM: 9.5 minutes to a first result on a throttled
          connection; potion-base-8M: 10.2 minutes) and then picked keyword-only over the
          purpose-built static matrix, even though that matrix was built in the same round
          specifically to solve the cold-start problem, and solved it completely (9.6 seconds).
          It still lost, on the mechanical tie-break, to an option that cost nothing because it
          already existed. That&apos;s the point of measuring instead of guessing: the
          &quot;obviously more sophisticated&quot; choice never got to compete on its actual
          merits once its real cold start was honestly measured.
        </p>

        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          Read those recall numbers with two limits stated plainly.{" "}
          <MetricProvenance
            info={getProvenance("search:eval-limitations", undefined, VERIFIED_AT)}
            label="the eval's own limitations"
          >
            This comparison ran on 28 queries against the 13 projects the catalog held at the
            time, a random 3-guess baseline would already clear about 23% Recall@3 by chance, so
            every tier&apos;s 85–100% is a genuine signal, but scores this close to 100%
            don&apos;t by themselves prove sophisticated retrieval on a catalog this distinct;
            the 28 queries are LLM-generated, not collected from real recruiters, real search
            logs, or real usage; and the catalog has grown since without the comparison being
            re-run against it, so those numbers describe the run as it happened, not today
          </MetricProvenance>
          .
        </p>

        <p className="text-muted-foreground mt-5 text-caption">
          Full comparison, every command, every measurement:{" "}
          <InlineLink
            href="https://github.com/gaurav-gandhi-2411/gg-portfolio/blob/main/reports/BL-9-round5-static-embedding-and-decision.md"
            className="text-caption"
          >
            reports/BL-9-round5-static-embedding-and-decision.md ↗
          </InlineLink>
        </p>
      </div>
    </SearchMethodologyDisclosure>
  );
}
