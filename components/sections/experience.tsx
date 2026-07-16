import { InlineLink } from "@/components/inline-link";
import { Section } from "@/components/section";
import { aboutParagraphs, skillChips } from "@/content/about";
import { experience } from "@/content/experience";
import { site } from "@/content/site";

/**
 * Wave 6: Experience tightened from a four-paragraph-per-role résumé wall
 * (~40% of the mobile page) to supporting evidence — the day-job context
 * paragraph from the dissolved About section leads, each role shows its
 * `featured` bullets (selection, not rewriting: every shown bullet is
 * verbatim from content/experience.ts with its sourceRef), and the skill
 * chips became one plain-prose line. The full detail is the resume's job —
 * linked right here.
 */
export function Experience() {
  return (
    <Section id="experience" label="Experience">
      <p className="text-muted-foreground max-w-[62ch] text-base leading-relaxed">
        {aboutParagraphs[1]}
      </p>

      <div className="mt-10 flex flex-col gap-10">
        {experience.map((entry) => (
          <article key={entry.company} className="flex flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h3 className="font-heading text-lead font-semibold text-foreground">
                  {entry.company}
                </h3>
                <span className="text-muted-foreground font-mono text-xs">
                  {entry.dateRange}
                </span>
              </div>
              {entry.companyDetail && (
                <p className="text-muted-foreground mt-1 text-sm">{entry.companyDetail}</p>
              )}
            </div>

            {entry.subRoles?.map((role) => {
              const bullets = role.bullets.filter((b) => b.featured);
              if (bullets.length === 0) return null;
              // Single-role companies already show these dates on the company
              // line — repeating them reads as a résumé tic.
              const showDates =
                (entry.subRoles?.length ?? 0) > 1 || role.dateRange !== entry.dateRange;
              return (
                <div key={role.title} className="flex flex-col gap-2">
                  <p className="text-sm">
                    <span className="font-medium text-foreground">{role.title}</span>
                    {showDates && (
                      <span className="text-muted-foreground font-mono text-xs">
                        {" "}
                        · {role.dateRange}
                      </span>
                    )}
                  </p>
                  <ul className="flex max-w-[62ch] flex-col gap-2">
                    {bullets.map((bullet) => (
                      <li
                        key={bullet.sourceRef}
                        className="text-muted-foreground text-sm leading-relaxed"
                      >
                        {bullet.text}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </article>
        ))}
      </div>

      <p className="text-muted-foreground mt-10 max-w-[62ch] text-sm leading-relaxed">
        Working across {skillChips.join(" · ")}.
      </p>

      <p className="mt-6 text-sm">
        <InlineLink href={site.resumeUrl} download>
          Download the full resume (PDF)
        </InlineLink>
      </p>
    </Section>
  );
}
