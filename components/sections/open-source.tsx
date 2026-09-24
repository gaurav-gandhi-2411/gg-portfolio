import Link from "next/link";
import {
  InReviewGroup,
  LandedUpstreamGroup,
  OwnPackagesGroup,
} from "@/components/open-source-groups";
import { Section } from "@/components/section";
import {
  landedUpstreamCount,
  openSourceInReview,
  openSourceLanded,
  openSourcePackages,
} from "@/content/open-source";
import { getPypiStats } from "@/lib/live-data";

/**
 * refresh-2026-09 Phase C, owner decision D2 — a new homepage section
 * between Work and Research: fixes landed on other people's repos, sitting
 * next to the products built under GG's own name. See app/page.tsx's own
 * section-order comment for the placement history this extends.
 *
 * Same data as /open-source (that page carries the fuller layout); this
 * section is the compact teaser, same shared components as the page uses so
 * the two can never drift apart the way a hand-duplicated list would.
 */
export async function OpenSource() {
  const pypiStats = await getPypiStats(openSourcePackages.map((p) => p.packageName));

  return (
    <Section
      id="open-source"
      label="Open source"
      width="wide"
      // Derived, never hand-typed (rule 65b) — mirrors researchPaperCount's pattern.
      labelNote={`${landedUpstreamCount(openSourceLanded)} fixes landed upstream`}
      lede="Bug fixes I sent to other people's projects, plus the packages I publish under my own name."
    >
      <div className="flex flex-col gap-[var(--space-8)]">
        <LandedUpstreamGroup items={openSourceLanded} />
        <InReviewGroup entries={openSourceInReview} />
        <OwnPackagesGroup packages={openSourcePackages} pypiStats={pypiStats} />

        <p className="text-center">
          <Link
            href="/open-source"
            className="text-accent focus-visible:outline-ring -my-2.5 inline-flex min-h-11 items-center text-sm font-medium transition-colors duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            More on the open source page →
          </Link>
        </p>
      </div>
    </Section>
  );
}
