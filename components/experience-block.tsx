import type { ExperienceEntry } from "@/content/types";

/** One employer entry rendered as a dense editorial timeline row, not a card. */
export function ExperienceBlock({ entry }: { entry: ExperienceEntry }) {
  return (
    <article className="border-border grid grid-cols-12 gap-x-6 gap-y-6 border-t py-12 first:border-t-0 first:pt-0">
      <div className="col-span-12 lg:col-span-4">
        <h3 className="font-heading text-3xl font-black md:text-4xl">{entry.company}</h3>
        {entry.companyDetail ? (
          <p className="text-muted-foreground mt-1 text-sm">{entry.companyDetail}</p>
        ) : null}
        <p className="text-muted-foreground mt-3 text-xs tracking-[0.2em] uppercase">
          {entry.dateRange}
        </p>
        <p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
          {entry.location}
        </p>
        <p className="text-muted-foreground mt-4 flex flex-wrap gap-x-3 gap-y-2 text-xs tracking-wider uppercase">
          {entry.techChips.map((chip, i) => (
            <span key={chip}>
              {i > 0 ? <span aria-hidden="true"> / </span> : null}
              {chip}
            </span>
          ))}
        </p>
      </div>

      <div className="col-span-12 lg:col-span-8">
        {entry.subRoles?.map((role) => (
          <div key={role.title} className="mb-8 last:mb-0">
            <p className="font-heading text-xl font-semibold">
              {role.title}
              <span className="text-muted-foreground ml-3 text-xs tracking-[0.2em] uppercase">
                {role.dateRange}
              </span>
            </p>
            <ul className="text-muted-foreground mt-4 space-y-3 text-base leading-relaxed">
              {role.bullets.map((bullet) => (
                <li key={bullet.text} className="border-border border-l pl-4">
                  {bullet.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {entry.bullets ? (
          <ul className="text-muted-foreground space-y-3 text-base leading-relaxed">
            {entry.bullets.map((bullet) => (
              <li key={bullet.text} className="border-border border-l pl-4">
                {bullet.text}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
