import { MetricProvenance } from "@/components/metric-provenance";
import { headlineStats } from "@/content/stats";
import { getProvenance } from "@/lib/provenance";

/** Last checked against content/provenance.md's "Hero stats" table. */
const VERIFIED_AT = "2026-08-21";

/**
 * Three numbers, stated once, above the About prose.
 *
 * They are the only figures on the homepage that come from paid work rather
 * than from something you can click and use, so they are also the only ones a
 * reader cannot check for themselves. Each number carries the same
 * MetricProvenance hover/tap disclosure every case-study metric uses
 * (components/metric-provenance.tsx) — the source is one interaction on the
 * number itself, not a separate "Where these come from" caption underneath
 * all three (GG's launch-review call: a standalone line announcing rigor
 * reads as the page arguing with itself before a visitor asked; the same
 * per-number disclosure everywhere else on the site does the job quietly).
 */
export function HeadlineStats() {
  return (
    /*
     * The link sits OUTSIDE the <dl>, not inside it as a <p>.
     *
     * A definition list may only contain dt, dd, div, script and template, so
     * a <p> child is invalid markup and axe's definition-list rule failed the
     * homepage on it, in both the plain and WebGL-active scans. Caught by the
     * suite, which is the whole reason the suite runs on every section.
     */
    <div className="border-border/40 mb-[var(--space-10)] border-b pb-[var(--space-8)]">
      <dl className="grid gap-[var(--space-6)] sm:grid-cols-3 sm:gap-[var(--space-8)]">
        {headlineStats.map((stat) => {
          const provenance = getProvenance(stat.sourceRef, undefined, VERIFIED_AT);
          return (
            <div
              key={stat.label}
              className="flex flex-col gap-[var(--space-1)] text-center sm:text-left"
            >
              <dt className="sr-only">{stat.label}</dt>
              <dd className="flex flex-col gap-[var(--space-1)]">
                <span className="font-heading text-heading font-semibold text-foreground">
                  <MetricProvenance info={provenance} label={stat.label}>
                    {stat.value}
                  </MetricProvenance>
                </span>
                <span className="text-muted-foreground text-sm leading-snug">{stat.label}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
