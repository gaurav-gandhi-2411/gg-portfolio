/**
 * Editorial section marker: a numeral paired with a tracked-out caps title.
 * Reused at the top of every numbered section ("01 — About", ...) so the
 * numbering reads as a structural design element throughout the page. The
 * label is a real <h2> (numeral stays aria-hidden/decorative) so the
 * document outline stays correct for assistive tech. Wave 5: the numeral
 * dropped from a 56-104px display element to --text-heading (35px) — it
 * marks the section, it doesn't headline it. Deliberately below
 * --text-display's 40px mobile floor: the design-review pass caught that at
 * --text-stat (44px) the decorative numeral out-sized the h1 name on every
 * viewport ≤800px — a hierarchy inversion, not restraint.
 */
export function SectionMark({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span
        aria-hidden="true"
        className="font-heading text-border select-none text-heading font-semibold"
      >
        {index}
      </span>
      <h2 className="text-muted-foreground text-xs font-normal tracking-eyebrow uppercase md:text-sm">
        {label}
      </h2>
    </div>
  );
}
