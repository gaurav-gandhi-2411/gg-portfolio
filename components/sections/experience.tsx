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
 * Wave 13 — desktop composition: at xl each card splits into a meta rail
 * (company, dates, location, tech) beside the bullet column — the classic
 * resume geometry — so the card's width at 1280–1600px is carrying
 * information, not padding. Below xl the wave-12 layout is unchanged.
 */
export function Experience() {
  return (
    <Section id="experience" label="Experience" width="wide">
      <RevealGroup mode="onview" className="flex flex-col gap-6">
        {experience.map((entry) => (
          <article
            key={entry.company}
            className="border-border/40 bg-card/40 rounded-xl border p-6 md:p-8"
          >
            {/* 16rem rail: the longest tech chip ("Bayesian Change-Point
                Detection") wrapped into a stretched capsule at 14rem
                (design-review finding 3). */}
            <div className="xl:grid xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-x-10">
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 xl:flex-col xl:gap-y-2">
                  <h3 className="font-heading text-lead font-semibold text-foreground">
                    {entry.company}
                  </h3>
                  <span className="text-muted-foreground font-mono text-xs">
                    {entry.dateRange}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 text-sm xl:mt-2">
                  {entry.companyDetail ? `${entry.companyDetail} · ` : ""}
                  {entry.location}
                </p>

                <p className="mt-6 hidden flex-wrap gap-2 xl:flex">
                  {entry.techChips.map((chip) => (
                    <span
                      key={chip}
                      className="border-border/40 text-muted-foreground rounded-full border px-3 py-1 font-mono text-xs"
                    >
                      {chip}
                    </span>
                  ))}
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-5 xl:mt-0">
                {entry.subRoles?.map((role) => {
                  const showDates =
                    (entry.subRoles?.length ?? 0) > 1 || role.dateRange !== entry.dateRange;
                  return (
                    <div key={role.title} className="flex flex-col gap-2.5">
                      <p className="text-sm">
                        <span className="font-medium text-foreground">{role.title}</span>
                        {showDates && (
                          <span className="text-muted-foreground font-mono text-xs">
                            {" "}
                            · {role.dateRange}
                          </span>
                        )}
                      </p>
                      <ul className="flex flex-col gap-2">
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

            <p className="mt-6 flex flex-wrap gap-2 xl:hidden">
              {entry.techChips.map((chip) => (
                <span
                  key={chip}
                  className="border-border/40 text-muted-foreground rounded-full border px-3 py-1 font-mono text-xs"
                >
                  {chip}
                </span>
              ))}
            </p>
          </article>
        ))}

        <p className="mt-2 text-center">
          <LinkButton href={site.resumeUrl} icon={<FileTextIcon />}>
            View the full resume
          </LinkButton>
        </p>
      </RevealGroup>
    </Section>
  );
}
