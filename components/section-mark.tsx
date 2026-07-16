/**
 * Editorial section marker: a numeral paired with a tracked-out caps title.
 * Reused at the top of every numbered section ("01 — About", ...) so the
 * numbering reads as a structural design element throughout the page. The
 * label is a real <h2> (numeral stays aria-hidden/decorative) so the
 * document outline stays correct for assistive tech. Wave 5: the numeral
 * dropped from a 56-104px display element to --text-stat (44px) — it marks
 * the section, it doesn't headline it.
 */
export function SectionMark({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span
        aria-hidden="true"
        className="font-heading text-border select-none text-stat font-semibold"
      >
        {index}
      </span>
      <h2 className="text-muted-foreground text-xs font-normal tracking-[0.35em] uppercase md:text-sm">
        {label}
      </h2>
    </div>
  );
}
