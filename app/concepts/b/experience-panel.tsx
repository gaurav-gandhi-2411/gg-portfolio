import type { ExperienceEntry } from "@/content/types";
import { TechChips } from "./tech-chips";

function slugify(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function ExperiencePanel({ entries }: { entries: ExperienceEntry[] }) {
  return (
    <div className="flex flex-col gap-8">
      {entries.map((entry) => (
        <div key={entry.company} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h3 className="font-mono text-sm font-bold text-foreground">
              <span className="text-accent">$</span> cd {slugify(entry.company)}
              {entry.companyDetail && (
                <span className="ml-2 font-normal text-muted-foreground"># {entry.companyDetail}</span>
              )}
            </h3>
            <p className="font-mono text-xs text-muted-foreground">
              {entry.dateRange} · {entry.location}
            </p>
          </div>

          {entry.subRoles?.map((role) => (
            <div key={role.title} className="flex flex-col gap-2 border-l-2 border-border pl-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h4 className="font-mono text-sm font-semibold text-foreground">{role.title}</h4>
                <p className="font-mono text-[11px] text-muted-foreground">{role.dateRange}</p>
              </div>
              <ul className="flex flex-col gap-1.5">
                {role.bullets.map((bullet) => (
                  <li
                    key={bullet.sourceRef}
                    className="font-mono text-xs leading-relaxed text-foreground"
                  >
                    <span className="text-muted-foreground">- </span>
                    {bullet.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {entry.bullets && (
            <ul className="flex flex-col gap-1.5 border-l-2 border-border pl-4">
              {entry.bullets.map((bullet) => (
                <li key={bullet.sourceRef} className="font-mono text-xs leading-relaxed text-foreground">
                  <span className="text-muted-foreground">- </span>
                  {bullet.text}
                </li>
              ))}
            </ul>
          )}

          <TechChips chips={entry.techChips} />
        </div>
      ))}
    </div>
  );
}
