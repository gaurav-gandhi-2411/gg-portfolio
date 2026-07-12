import { Badge } from "@/components/ui/badge";
import { experience } from "@/content/experience";

export function Experience() {
  return (
    <section id="experience" className="mx-auto w-full max-w-4xl px-6 py-16">
      <h2 className="font-heading text-sm font-semibold tracking-widest text-accent uppercase">
        Professional Experience
      </h2>
      <div className="mt-6 flex flex-col gap-10">
        {experience.map((entry) => (
          <div key={entry.company} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                <h3 className="font-heading text-xl font-semibold text-foreground">
                  {entry.company}
                  {entry.companyDetail && (
                    <span className="ml-2 text-base font-normal text-muted-foreground">
                      ({entry.companyDetail})
                    </span>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">{entry.location}</p>
              </div>
              <p className="font-mono text-sm text-muted-foreground">{entry.dateRange}</p>
            </div>

            {entry.subRoles?.map((role) => (
              <div key={role.title} className="flex flex-col gap-2 border-l-2 border-border pl-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h4 className="font-medium text-foreground">{role.title}</h4>
                  <p className="font-mono text-xs text-muted-foreground">{role.dateRange}</p>
                </div>
                <ul className="flex flex-col gap-2">
                  {role.bullets.map((bullet) => (
                    <li key={bullet.sourceRef} className="text-sm leading-relaxed text-foreground">
                      {bullet.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              {entry.techChips.map((chip) => (
                <Badge key={chip} variant="outline" className="font-mono text-xs">
                  {chip}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
