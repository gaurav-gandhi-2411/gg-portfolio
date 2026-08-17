import Link from "next/link";
import { headlineStats } from "@/content/stats";

/**
 * Three numbers, stated once, above the About prose.
 *
 * They are the only figures on the homepage that come from paid work rather
 * than from something you can click and use, so they are also the only ones a
 * reader cannot check for themselves. Each links into the role ladder, which
 * is where the sentence it was taken from actually lives, with the company,
 * the dates and the rest of the bullet around it. A number with nowhere to go
 * is a claim; a number that lands you on its own bullet is a citation.
 *
 * One link target rather than three anchors per bullet: the refs are stable
 * data (see content/stats.ts) but the bullets have no ids of their own, and
 * inventing per-bullet anchors to satisfy a hover would be building a URL
 * scheme for a hover.
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
        {headlineStats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-[var(--space-1)] text-center sm:text-left">
            <dt className="sr-only">{stat.label}</dt>
            <dd className="flex flex-col gap-[var(--space-1)]">
              <span className="font-heading text-heading font-semibold text-foreground">
                {stat.value}
              </span>
              <span className="text-muted-foreground text-sm leading-snug">{stat.label}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-muted-foreground mt-[var(--space-5)] text-center text-caption sm:text-left">
        <Link
          href="/#experience"
          className="focus-visible:outline-ring underline decoration-dotted underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          Where these come from
        </Link>
      </p>
    </div>
  );
}
