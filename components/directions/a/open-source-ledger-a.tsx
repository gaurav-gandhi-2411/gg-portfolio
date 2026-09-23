import Link from "next/link";
import { InlineLink } from "@/components/inline-link";
import { Section } from "@/components/section";
import {
  landedUpstreamCount,
  openSourceLanded,
  openSourcePackages,
} from "@/content/open-source";

/**
 * Direction A ("Editorial / credibility-first") homepage Open source
 * section: a compact ledger of landed upstream fixes, each row carrying the
 * repo, what changed, and a direct link to the landing commit — proof
 * someone else's project accepted the change, read at a glance rather than
 * unpacked one card at a time. Same content/open-source.ts data the shipped
 * section (components/sections/open-source.tsx) and /open-source page
 * read from; this is presentation only. Proposal only, `explore/refresh-d-
 * direction-a`, never merged.
 */
export function OpenSourceLedgerA() {
  return (
    <Section
      id="open-source"
      label="Open source"
      width="wide"
      labelNote={`${landedUpstreamCount(openSourceLanded)} fixes landed upstream`}
      lede="Bug fixes I sent to other people's projects, plus the packages I publish under my own name."
    >
      <div className="flex flex-col gap-[var(--space-6)]">
        <ul role="list" className="border-border/40 flex flex-col divide-y divide-border/40 border-t">
          {openSourceLanded.map((item) => (
            <li
              key={item.sourceRef}
              className="grid grid-cols-1 gap-x-[var(--space-6)] gap-y-[var(--space-2)] py-[var(--space-4)] md:grid-cols-[minmax(9rem,13rem)_1fr_auto] md:items-baseline"
            >
              <span className="text-muted-foreground font-mono text-caption">{item.repo}</span>
              <p className="text-sm leading-relaxed text-foreground">
                {item.title}
                <span className="text-muted-foreground"> — {item.whatChanged}</span>
              </p>
              <p className="flex flex-wrap gap-x-4 gap-y-[var(--space-1)] text-sm md:justify-end">
                <InlineLink href={item.prUrl}>PR #{item.prNumber} ↗</InlineLink>
                <InlineLink href={item.commitUrl}>
                  {item.commitSha.slice(0, 7)} ↗
                </InlineLink>
              </p>
            </li>
          ))}
        </ul>

        <p className="text-muted-foreground text-center text-sm">
          Plus {openSourcePackages.length} packages published under my own name.{" "}
          <Link
            href="/open-source"
            className="text-accent focus-visible:outline-ring -my-2.5 inline-flex min-h-11 items-center font-medium transition-colors duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            More on the open source page →
          </Link>
        </p>
      </div>
    </Section>
  );
}
