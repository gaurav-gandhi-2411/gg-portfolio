import type { Metadata } from "next";
import Link from "next/link";
import {
  InReviewGroup,
  LandedUpstreamGroup,
  OwnPackagesGroup,
} from "@/components/open-source-groups";
import {
  landedUpstreamCount,
  openSourceInReview,
  openSourceLanded,
  openSourcePackages,
} from "@/content/open-source";
import { getPypiStats } from "@/lib/live-data";

export const metadata: Metadata = {
  title: "Open source · Gaurav Gandhi",
  description:
    "Fixes landed upstream in other people's AI/ML projects, plus the packages I publish under my own name.",
  alternates: { canonical: "/open-source" },
};

/**
 * refresh-2026-09 Phase C, owner decision D2 — the stable deep-link target
 * for open source work, sharing its groups with the homepage teaser
 * (components/open-source-groups.tsx) the same way /projects shares
 * ProjectGrid with the home Work section. This page carries the fuller
 * layout: its own page-level heading rather than a section h2, and a
 * labelled subheading ahead of each group instead of folding straight into
 * cards.
 */
export default async function OpenSourcePage() {
  const pypiStats = await getPypiStats(openSourcePackages.map((p) => p.packageName));

  return (
    <main
      id="main"
      className="ambient-plane mx-auto w-full max-w-3xl flex-1 px-6 pt-12 pb-20 md:pt-16 lg:max-w-5xl"
    >
      <div className="flex flex-col items-center text-center">
        <h1 className="font-heading text-heading font-semibold tracking-tight text-foreground">
          Open source
        </h1>
        {/* Derived, never hand-typed (rule 65b) — mirrors /projects' own count line. */}
        <p className="text-muted-foreground mt-3 font-mono text-caption">
          {landedUpstreamCount(openSourceLanded)} fixes landed upstream
        </p>
        <p className="text-muted-foreground mt-5 max-w-measure text-base leading-relaxed">
          Bug fixes I sent to projects I don&apos;t maintain, work still in review on those same
          projects, and the packages I publish and version under my own name.
        </p>
      </div>

      <div className="mt-12 flex flex-col gap-[var(--space-4)]">
        <h2 className="font-heading text-title font-semibold text-foreground">Landed upstream</h2>
        <LandedUpstreamGroup items={openSourceLanded} headingLevel="h3" />
      </div>

      <div className="mt-12 flex flex-col gap-[var(--space-4)]">
        <h2 className="font-heading text-title font-semibold text-foreground">In review</h2>
        <InReviewGroup entries={openSourceInReview} />
      </div>

      <div className="mt-12 flex flex-col gap-[var(--space-4)]">
        <h2 className="font-heading text-title font-semibold text-foreground">Own packages</h2>
        <OwnPackagesGroup packages={openSourcePackages} pypiStats={pypiStats} headingLevel="h3" />
      </div>

      <p className="mt-12 text-center">
        <Link
          href="/"
          className="text-accent focus-visible:outline-ring -my-2.5 inline-flex min-h-11 items-center text-sm font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          ← Back to home
        </Link>
      </p>
    </main>
  );
}
