import { MetricProvenance } from "@/components/metric-provenance";
import type { CaseStudy } from "@/content/types";
import { getProvenance } from "@/lib/provenance";

/** A strip is a glance, not a second Results section: three at most. */
const MAX_ITEMS = 3;
/**
 * Longest value (characters) that still reads as a numeral at display size.
 * Longer, sentence-like values stay in the Results section only.
 */
const MAX_VALUE_LENGTH = 30;
/** One chip alone reads as a pull-quote, not a strip. */
const MIN_ITEMS = 2;

/**
 * A compact row of the case study's own first short-numeral results, at the
 * top of the page. It holds no numbers of its own: every item is a row of
 * `study.results`, passed through unchanged, with the same sourceRef-derived
 * provenance disclosure the Results section uses, so the freshness and
 * consistency checks that cover `results` cover the strip too. Rows without
 * a resolvable provenance entry are skipped rather than shown unsourced.
 * Selection is positional (the first eligible rows), not curated.
 */
export function ProofStrip({ study, repoUrl }: { study: CaseStudy; repoUrl?: string }) {
  const items = (study.results ?? [])
    .filter((r) => r.format !== "prose" && r.value.length <= MAX_VALUE_LENGTH)
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
            className="proof-strip-item relative"
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
