import { FileTextIcon } from "@/components/icons";
import { LinkButton } from "@/components/link-button";
import { RevealGroup } from "@/components/reveal-group";
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
 */
export function Experience() {
  return (
    <Section id="experience" label="Experience" width="wide">
      <RevealGroup mode="onview" className="flex flex-col gap-[var(--space-6)]">
        {experience.map((entry) => (
          <article
            key={entry.company}
            className="border-border/40 bg-card/40 rounded-xl border p-6 md:p-8"
          >
            {/* 16rem rail: the longest tech chip ("Bayesian Change-Point
                Detection") wrapped into a stretched capsule at 14rem
                (design-review finding 3). */}
            <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-x-10">
              <div>
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
                      <p className="text-sm">
                        <span className="font-medium text-foreground">{role.title}</span>
                        {showDates && (
                          <span className="text-muted-foreground font-mono text-caption">
                            {" "}
                            · {role.dateRange}
                          </span>
                        )}
                      </p>
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
      </RevealGroup>
    </Section>
  );
}
