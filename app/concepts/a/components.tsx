import type { ExperienceEntry, Product } from "@/content/types";
import { cn } from "@/lib/utils";

/**
 * Periodical-style section marker: a genuinely large numeral (not a small
 * eyebrow label) paired with a tracked-out caps title. Reused at the top of
 * every numbered section ("01 — About", "02 — Work", ...) so the numbering
 * reads as a structural design element throughout the page.
 */
export function SectionMark({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-end gap-4 md:gap-6">
      <span
        aria-hidden="true"
        className="font-heading text-border select-none text-[clamp(3.5rem,9vw,6.5rem)] leading-[0.8] font-black"
      >
        {index}
      </span>
      <span className="text-muted-foreground pb-2 text-xs tracking-[0.35em] uppercase md:pb-4 md:text-sm">
        {label}
      </span>
    </div>
  );
}

/** External text link whose underline shifts from muted to accent on hover/focus. */
export function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "text-foreground decoration-border underline decoration-1 underline-offset-4",
        "transition-colors duration-300 hover:decoration-accent focus-visible:decoration-accent",
        "motion-reduce:transition-none"
      )}
    >
      {children}
    </a>
  );
}

/**
 * One flagship product presented as a magazine feature spread: name, dek,
 * a pull-quote treatment of the storyLine (the concept's signature element),
 * and the headline metric rendered as a standalone giant stat. Alternates
 * text/stat column order by `order` to keep the grid asymmetric across the
 * three flagship spreads rather than repeating one fixed layout.
 */
export function FlagshipFeature({ product, order }: { product: Product; order: number }) {
  const flipped = order % 2 === 0;

  return (
    <article
      className={cn(
        "grid grid-cols-12 gap-x-6 gap-y-10 border-t border-border pt-16",
        order === 1 && "border-t-0 pt-0"
      )}
    >
      <div
        className={cn(
          "col-span-12 lg:col-span-7",
          flipped ? "lg:order-2 lg:col-start-6" : "lg:col-start-1"
        )}
      >
        <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
          Flagship — {String(order).padStart(2, "0")} / 03
        </p>
        <h3 className="font-heading mt-3 text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] font-black">
          {product.name}
        </h3>
        <p className="font-heading text-muted-foreground mt-6 max-w-[46ch] text-[clamp(1.25rem,2.2vw,1.75rem)] italic">
          {product.tagline}
        </p>

        {product.storyLine ? (
          <blockquote className="border-accent relative mt-10 max-w-[48ch] border-l-2 pl-8">
            <span
              aria-hidden="true"
              className="font-heading text-accent absolute -top-8 -left-1 text-[6rem] leading-none select-none"
            >
              &ldquo;
            </span>
            <p className="font-heading text-[clamp(1.375rem,2.4vw,2rem)] leading-snug font-normal">
              {product.storyLine.text}
            </p>
          </blockquote>
        ) : null}

        {product.techChips ? (
          <p className="text-muted-foreground mt-8 flex flex-wrap gap-x-3 gap-y-2 text-xs tracking-wider uppercase">
            {product.techChips.map((chip, i) => (
              <span key={chip}>
                {i > 0 ? <span aria-hidden="true"> / </span> : null}
                {chip}
              </span>
            ))}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {product.liveUrl ? <InlineLink href={product.liveUrl}>View live →</InlineLink> : null}
          {product.repoUrl ? <InlineLink href={product.repoUrl}>Source →</InlineLink> : null}
        </div>
      </div>

      <div
        className={cn(
          "col-span-12 lg:col-span-4",
          flipped ? "lg:order-1 lg:col-start-1" : "lg:col-start-9"
        )}
      >
        {product.metric ? (
          <div>
            <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
              {product.metric.label}
            </p>
            <p className="font-heading mt-3 text-[clamp(2.25rem,5.5vw,4.5rem)] leading-[0.95] font-black tabular-nums">
              {product.metric.value}
            </p>
          </div>
        ) : null}
        {product.secondaryMetric ? (
          <div className="mt-8">
            <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
              {product.secondaryMetric.label}
            </p>
            <p className="font-heading mt-2 text-2xl font-semibold tabular-nums">
              {product.secondaryMetric.value}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Secondary products rendered as a plain editorial index — one row per
 * product (number, title, tagline, headline figure) — with no card chrome,
 * as distinct from the flagship spreads above.
 */
export function SecondaryIndex({ products }: { products: Product[] }) {
  return (
    <ol className="divide-border mt-6 divide-y border-t border-border">
      {products.map((product, i) => {
        const figure = product.metric?.value ?? product.pypi?.installCommand ?? null;
        return (
          <li key={product.slug} className="grid grid-cols-12 items-baseline gap-x-6 py-6">
            <span
              aria-hidden="true"
              className="font-heading text-muted-foreground col-span-2 text-lg md:col-span-1"
            >
              {String(i + 4).padStart(2, "0")}
            </span>
            <span className="font-heading col-span-10 text-lg font-semibold md:col-span-3">
              {product.name}
            </span>
            <span className="text-muted-foreground col-span-12 mt-2 text-sm md:col-span-6 md:mt-0">
              {product.tagline}
            </span>
            {figure ? (
              <span className="col-span-12 text-sm tabular-nums md:col-span-2 md:text-right">
                {figure}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

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
