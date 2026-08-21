import { FileTextIcon } from "@/components/icons";
import { LinkButton } from "@/components/link-button";
import { Section } from "@/components/section";
import { experience } from "@/content/experience";
import { site } from "@/content/site";

/**
 * Wave 12 — Experience sits first-after-About with the full professional
 * treatment: company cards with role, dates, location, every impact
 * bullet, and a tech-chip row per company.
 *
 * Wave 13 — desktop composition: at lg each card splits into a meta rail
 * (company, dates, location, tech) beside the bullet column — the classic
 * resume geometry — so the card's width at 1024–1600px is carrying
 * information, not padding. Below lg the wave-12 layout is unchanged (breakpoint moved from xl to lg in the 2026-07-30 UI/UX wave — see section.tsx).
 *
 * GG's launch-review round two dropped the RevealGroup wrapper — see
 * components/sections/about.tsx's header for why (components/section.tsx's
 * `.section-content` now carries the continuous entrance).
 */
export function Experience() {
  return (
    <Section id="experience" label="Experience" width="wide">
      <div className="flex flex-col gap-[var(--space-6)]">
        {experience.map((entry) => (
          <article
            key={entry.company}
            className="border-border/40 bg-card/40 rounded-xl border p-6 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-accent/50 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:p-8"
          >
            {/* 16rem rail: the longest tech chip ("Bayesian Change-Point
                Detection") wrapped into a stretched capsule at 14rem
                (design-review finding 3). */}
            <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-x-10">
              {/*
               * The rail sticks while its own card is in view.
               *
               * The Uber card runs about 800px tall at 1440px because it
               * carries three roles, and the rail's content (company, dates,
               * location, chips) is roughly 280px of that. The remaining
               * ~520px was empty column: the reader lost the company name
               * exactly when the bullets got long enough to need it.
               *
               * top-24 clears the sticky nav pill rather than sliding under
               * it. Scoped to lg because below that the rail is stacked above
               * the bullets, where sticky would pin a header over the text it
               * belongs to.
               */}
              <div className="lg:sticky lg:top-24 lg:self-start">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 lg:flex-col lg:gap-y-[var(--space-2)]">
                  <h3 className="font-heading text-lead font-semibold text-foreground">
                    {entry.company}
                  </h3>
                  <span className="text-muted-foreground font-mono text-caption">
                    {entry.dateRange}
                  </span>
                </div>
                <p className="text-muted-foreground mt-[var(--space-1)] text-sm lg:mt-[var(--space-2)]">
                  {entry.companyDetail ? `${entry.companyDetail} · ` : ""}
                  {entry.location}
                </p>

                <p className="mt-[var(--space-6)] hidden flex-wrap gap-[var(--space-2)] lg:flex">
                  {entry.techChips.map((chip) => (
                    <span
                      key={chip}
                      className="border-border/40 text-muted-foreground rounded-full border px-[var(--space-3)] py-[var(--space-1)] font-mono text-caption"
                    >
                      {chip}
                    </span>
                  ))}
                </p>
              </div>

              <div className="mt-[var(--space-5)] flex flex-col gap-[var(--space-5)] lg:mt-0">
                {entry.subRoles?.map((role) => {
                  const showDates =
                    (entry.subRoles?.length ?? 0) > 1 || role.dateRange !== entry.dateRange;
                  return (
                    <div key={role.title} className="flex flex-col gap-[var(--space-2-5)]">
                      {/*
                       * h4 under the company's h3, rather than the <p> this
                       * was. Three roles at one company were previously
                       * indistinguishable from body text to anything reading
                       * the document outline, so a screen-reader user
                       * navigating by heading got one stop per company and no
                       * way to reach a specific role. Visual size is
                       * unchanged; this is outline, not styling.
                       */}
                      <h4 className="text-sm">
                        <span className="font-medium text-foreground">{role.title}</span>
                        {showDates && (
                          <span className="text-muted-foreground font-mono text-caption">
                            {" "}
                            · {role.dateRange}
                          </span>
                        )}
                      </h4>
                      <ul className="flex flex-col gap-[var(--space-2)]">
                        {role.bullets.map((bullet) => (
                          <li
                            key={bullet.sourceRef}
                            className="text-muted-foreground border-border/40 border-l-2 pl-4 text-sm leading-relaxed"
                          >
                            {bullet.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="mt-[var(--space-6)] flex flex-wrap gap-[var(--space-2)] lg:hidden">
              {entry.techChips.map((chip) => (
                <span
                  key={chip}
                  className="border-border/40 text-muted-foreground rounded-full border px-[var(--space-3)] py-[var(--space-1)] font-mono text-caption"
                >
                  {chip}
                </span>
              ))}
            </p>
          </article>
        ))}

        <p className="mt-[var(--space-2)] text-center">
          <LinkButton href={site.resumeUrl} icon={<FileTextIcon />}>
            View the full resume
          </LinkButton>
        </p>
      </div>
    </Section>
  );
}
