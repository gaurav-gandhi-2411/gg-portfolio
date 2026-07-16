/**
 * Periodical-style section marker: a genuinely large numeral (not a small
 * eyebrow label) paired with a tracked-out caps title. Reused at the top of
 * every numbered section ("00 — Live", "01 — About", ...) so the numbering
 * reads as a structural design element throughout the page. The label is a
 * real <h2> (numeral stays aria-hidden/decorative) so the document outline
 * stays correct for assistive tech.
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
      <h2 className="text-muted-foreground pb-2 text-xs font-normal tracking-[0.35em] uppercase md:pb-4 md:text-sm">
        {label}
      </h2>
    </div>
  );
}
