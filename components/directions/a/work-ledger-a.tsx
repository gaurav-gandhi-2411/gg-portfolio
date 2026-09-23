import Link from "next/link";
import { InlineLink } from "@/components/inline-link";
import { MetricProvenance } from "@/components/metric-provenance";
import { Section } from "@/components/section";
import { workLede } from "@/content/about";
import { liveProductCount, products } from "@/content/products";
import { getProvenance } from "@/lib/provenance";

/** Same convention as components/headline-stats.tsx's own VERIFIED_AT. */
const VERIFIED_AT = "2026-08-21";

/**
 * Direction A ("Editorial / credibility-first") homepage Work section.
 *
 * Same section shell and the same content/products.ts data every other
 * direction of this homepage reads from — the difference is presentation:
 * a dense, scannable list/table-like layout (name · one-line outcome ·
 * verified metric · links) instead of the shipped grid of illustrated
 * cards (components/project-card.tsx). Proposal only, `explore/refresh-d-
 * direction-a`, never merged.
 */
export function WorkLedgerA() {
  return (
    <Section
      id="work"
      label="Work"
      width="wide"
      labelNote={`${products.length} projects · ${liveProductCount(products)} live`}
      lede={workLede}
    >
      <ul role="list" className="border-border/40 flex flex-col divide-y divide-border/40 border-t">
        {products.map((product, i) => {
          const provenance = product.metric
            ? getProvenance(product.metric.sourceRef, undefined, VERIFIED_AT)
            : null;
          return (
            <li
              key={product.slug}
              className="relative grid grid-cols-1 gap-x-[var(--space-6)] gap-y-[var(--space-2)] py-[var(--space-5)] md:grid-cols-[2.25rem_minmax(9rem,14rem)_1fr_minmax(11rem,14rem)] md:items-baseline"
            >
              <span
                aria-hidden="true"
                className="text-muted-foreground/60 hidden font-mono text-caption md:block"
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              <h3 className="font-heading text-lead font-semibold text-foreground">
                <Link
                  href={`/work/${product.slug}`}
                  className="card-stretch-link focus-visible:outline-ring -my-2 inline-flex min-h-11 items-center transition-colors duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                >
                  {product.name}
                </Link>
              </h3>

              <p className="text-muted-foreground max-w-measure text-sm leading-relaxed">
                {product.tagline}
              </p>

              <div className="flex flex-col gap-[var(--space-1)] md:items-end md:text-right">
                {product.metric ? (
                  // A div, not a <p>: MetricProvenance's disclosure panel renders
                  // <p>/<ul> internally, and a <p> can never contain block content
                  // (the browser closes it early, which is a real hydration
                  // mismatch, not just invalid markup — see the sitewide
                  // convention this follows, components/case-study-page.tsx's own
                  // MetricProvenance usage sits inside a <dd>, never a <p>).
                  <div className="text-sm">
                    <span className="font-mono font-medium text-foreground">
                      <MetricProvenance info={provenance} label={product.metric.label}>
                        {product.metric.value}
                      </MetricProvenance>
                    </span>
                    <span className="text-muted-foreground"> · {product.metric.label}</span>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No published metric yet</p>
                )}
                <p className="flex flex-wrap gap-x-4 gap-y-[var(--space-1)] text-sm md:justify-end">
                  <Link
                    href={`/work/${product.slug}`}
                    className="card-clickable text-accent focus-visible:outline-ring -my-2 inline-flex min-h-9 items-center font-medium transition-colors duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                  >
                    Case study →
                  </Link>
                  {product.liveUrl && (
                    <InlineLink
                      href={product.liveUrl}
                      className="card-clickable -my-2 inline-flex min-h-9 items-center"
                    >
                      Live ↗
                    </InlineLink>
                  )}
                  {product.repoUrl && (
                    <InlineLink
                      href={product.repoUrl}
                      className="card-clickable -my-2 inline-flex min-h-9 items-center"
                    >
                      Source ↗
                    </InlineLink>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
