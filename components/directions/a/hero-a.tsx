import { FileTextIcon } from "@/components/icons";
import { InlineLink } from "@/components/inline-link";
import { LinkButton } from "@/components/link-button";
import { MetricProvenance } from "@/components/metric-provenance";
import { experience } from "@/content/experience";
import { headlineStats } from "@/content/stats";
import { site } from "@/content/site";
import { getProvenance } from "@/lib/provenance";

/** Last checked against content/provenance.md's "Hero stats" table — same
 * date the shipped hero's HeadlineStats cites (components/headline-stats.tsx). */
const VERIFIED_AT = "2026-08-21";

/**
 * Direction A ("Editorial / credibility-first") homepage hero.
 *
 * A proposal, not the shipped hero (components/sections/hero.tsx) — lives
 * only on `explore/refresh-d-direction-a`, never merged. Calm, typographic,
 * no WebGL field: the statement and the record carry the page instead of an
 * animated backdrop, which is the whole thesis of this direction versus
 * Direction B's product-card showcase.
 *
 * Title/company/current role are read from content/experience.ts's first
 * (most recent) entry rather than hand-typed, so this can never say
 * something the Experience section below it doesn't. The two stats are the
 * first two of content/stats.ts's headlineStats array — the same array the
 * shipped hero's HeadlineStats component renders in full — sliced, not
 * retyped, so the values and their sourceRef/provenance travel with them
 * (rule 65b).
 */
export function HeroA() {
  const current = experience[0];
  const currentRole = current?.subRoles?.[0];
  const stats = headlineStats.slice(0, 2);

  return (
    <header className="da-hero relative flex min-h-[calc(100svh-var(--nav-h))] w-full items-center">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-5)] px-[var(--space-6)] py-[var(--space-10)] md:py-[var(--space-16)] lg:max-w-5xl">
        <p>
          <a
            href="#contact"
            className="border-border/60 bg-card/60 text-muted-foreground focus-visible:outline-ring inline-flex min-h-8 items-center gap-[var(--space-2)] rounded-full border px-[var(--space-3)] py-[var(--space-1)] font-mono text-caption transition-colors duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
          >
            <span aria-hidden="true" className="bg-status-open live-dot size-1.5 shrink-0 rounded-full" />
            {site.status}
          </a>
        </p>

        <h1 className="font-heading text-display font-semibold text-foreground">{site.name}</h1>

        <p className="text-muted-foreground text-lead">
          {currentRole?.title ?? site.role}
          {" · "}
          {current?.company ?? site.name}
          {current?.companyDetail ? ` (${current.companyDetail})` : ""}
        </p>

        <p className="max-w-measure text-body-lg text-foreground/90 leading-relaxed">
          I build AI products and take them all the way to production, then publish the honest
          numbers behind them.
        </p>

        <dl className="mt-[var(--space-2)] flex flex-wrap gap-x-[var(--space-8)] gap-y-[var(--space-4)] border-border/40 border-t pt-[var(--space-5)]">
          {stats.map((stat) => {
            const provenance = getProvenance(stat.sourceRef, undefined, VERIFIED_AT);
            return (
              <div key={stat.label} className="relative flex flex-col gap-[var(--space-1)]">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="flex flex-col gap-[var(--space-1)]">
                  <span className="font-heading text-title font-semibold text-foreground">
                    <MetricProvenance info={provenance} label={stat.label}>
                      {stat.value}
                    </MetricProvenance>
                  </span>
                  <span className="text-muted-foreground max-w-40 text-sm leading-snug">
                    {stat.label}
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>

        <div className="mt-[var(--space-2)] flex flex-wrap items-center gap-x-[var(--space-6)] gap-y-[var(--space-3)]">
          <LinkButton href={site.resumeUrl} variant="primary" icon={<FileTextIcon />}>
            Résumé
          </LinkButton>
          <InlineLink href={`mailto:${site.email}`} sameTab>
            {site.email}
          </InlineLink>
          <InlineLink href={site.linkedinUrl}>LinkedIn</InlineLink>
        </div>
      </div>
    </header>
  );
}
