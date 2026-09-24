import { InlineLink } from "@/components/inline-link";
import type {
  OpenSourceInReviewEntry,
  OpenSourceLandedItem,
  OpenSourcePackage,
} from "@/content/types";
import type { PypiStatsByPackage } from "@/lib/live-data";

/**
 * refresh-2026-09 Phase C — the three "Open source" groups, shared by the
 * homepage section (components/sections/open-source.tsx) and the dedicated
 * /open-source page (app/open-source/page.tsx), the same way ProjectGrid is
 * shared by the home Work section and /projects. `headingLevel` follows that
 * component's own contract: h3 under the homepage section's h2, h2 under the
 * dedicated page's own h1.
 */

const cardClass =
  "section-card border-border/40 bg-card/40 flex flex-col gap-[var(--space-3)] rounded-xl border p-6 md:p-8";

export function LandedUpstreamGroup({
  items,
  headingLevel = "h3",
}: {
  items: OpenSourceLandedItem[];
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {items.map((item) => (
        <article key={item.sourceRef} className={cardClass}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <Heading className="font-heading text-lead font-semibold text-foreground">
              {item.repo}
            </Heading>
            <span className="text-muted-foreground font-mono text-caption">#{item.prNumber}</span>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">{item.whatChanged}</p>
          {item.viaCopybara && (
            <p className="text-muted-foreground text-caption">
              Shows as Closed on GitHub, not Merged: Google imports external pull requests through
              Copybara, which lands the change under its own internal commit rather than a normal
              merge.
            </p>
          )}
          <p className="text-muted-foreground text-caption">
            {item.releasedIn ? `First released in ${item.releasedIn}.` : "Not in a tagged release yet."}
          </p>
          <p className="flex flex-wrap gap-x-5 gap-y-[var(--space-2)] text-sm">
            <InlineLink href={item.prUrl}>Pull request ↗</InlineLink>
            <InlineLink href={item.commitUrl}>Landing commit ↗</InlineLink>
          </p>
        </article>
      ))}
    </div>
  );
}

export function InReviewGroup({ entries }: { entries: OpenSourceInReviewEntry[] }) {
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {entries.map((entry) => (
        <p key={entry.sourceRef} className="text-muted-foreground text-sm leading-relaxed">
          <span className="font-medium text-foreground">In review: </span>
          {entry.repo}{" "}
          {entry.pulls.map((pull, i) => (
            <span key={pull.number}>
              <InlineLink href={pull.url}>#{pull.number}</InlineLink>
              {i < entry.pulls.length - 1 ? ", " : " "}
            </span>
          ))}
          (open, not yet merged).
        </p>
      ))}
    </div>
  );
}

export function OwnPackagesGroup({
  packages,
  pypiStats,
  headingLevel = "h3",
}: {
  packages: OpenSourcePackage[];
  /** Looked up by each package's own PyPI project name (never a single blob) — see getPypiStats. */
  pypiStats: PypiStatsByPackage;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <div className="grid gap-[var(--space-4)] sm:grid-cols-3">
      {packages.map((pkg) => {
        const stats = pypiStats[pkg.packageName];
        return (
          <article key={pkg.sourceRef} className={cardClass}>
            <Heading className="font-heading text-lead font-semibold text-foreground">
              {pkg.name}
            </Heading>
            {/* Fails soft: a package whose registry lookup didn't come back at
                build/ISR time shows the name and links with no numbers, never
                a stale or fabricated version. */}
            {stats?.version !== undefined ? (
              <span data-live-value className="text-muted-foreground font-mono text-caption">
                v{stats.version}
                {stats.releaseCount !== undefined && stats.releaseCount > 1
                  ? ` · ${stats.releaseCount} releases`
                  : ""}
              </span>
            ) : (
              <span className="text-muted-foreground text-caption">Version unavailable right now.</span>
            )}
            <p className="flex flex-wrap gap-x-5 gap-y-[var(--space-2)] text-sm">
              <InlineLink href={pkg.pypiUrl}>PyPI ↗</InlineLink>
              <InlineLink href={pkg.repoUrl}>Repo ↗</InlineLink>
            </p>
          </article>
        );
      })}
    </div>
  );
}
