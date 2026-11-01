import { MetricProvenance } from "@/components/metric-provenance";
import type { CaseStudy } from "@/content/types";
import { getProvenance } from "@/lib/provenance";
import { headlineRows } from "@/lib/headline-rows";

/** A strip is a glance, not a second Results section: three at most. */
const MAX_ITEMS = 3;
/** One chip alone reads as a pull-quote, not a strip. */
const MIN_ITEMS = 2;

/**
 * A compact row of the case study's headline results at the top of the
 * page: exactly the results rows flagged `headline: true` (content/types.ts,
 * lib/headline-rows.ts), in Results order. It holds no numbers of its own:
 * every item is a row of `study.results`, passed through unchanged, with the
 * same sourceRef-derived provenance disclosure the Results section uses, so
 * the freshness and consistency checks that cover `results` cover the strip
 * too. e2e/case-study-proof-strip.spec.ts holds the flags to the strip's
 * shape (two or three short sourced numerals, never prose). The provenance
 * and MAX_ITEMS guards below only keep a bad flag from rendering unsourced
 * or overlong; the spec is what fails on one.
 */
export function ProofStrip({ study, repoUrl }: { study: CaseStudy; repoUrl?: string }) {
  const items = headlineRows(study.results)
    .map((result) => ({
      result,
      provenance: getProvenance(result.sourceRef, repoUrl, study.verifiedAt),
    }))
    .filter((item) => item.provenance !== null)
    .slice(0, MAX_ITEMS);

  if (items.length < MIN_ITEMS) return null;

  return (
    <section data-proof-strip aria-label="Headline results" className="proof-strip">
      <ul className="proof-strip-row">
        {items.map(({ result, provenance }) => (
          <li
            key={result.sourceRef + result.label}
            data-proof-item
            className="proof-strip-item"
          >
            <span data-proof-value className="proof-strip-value">
              {/* "Headline:" keeps this trigger's accessible name distinct from
                  the same row's trigger in the Results section below. */}
              <MetricProvenance
                info={provenance}
                label={`Headline: ${result.label}`}
                selfAnchor={false}
              >
                {result.value}
              </MetricProvenance>
            </span>
            <span data-proof-label className="proof-strip-label">
              {result.label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
