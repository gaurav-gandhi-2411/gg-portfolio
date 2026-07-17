/**
 * Wave 11 section shell — one centered axis for the whole page (GG's
 * direction: calm, centered, maninder-like restraint; the wave-6 sticky
 * label column put the h2 in a left rail and left the right half of a
 * 1440px viewport empty). The h2 is a centered, quiet heading; whitespace
 * does the separation (no hairline rules between sections); content sits
 * in the same centered column, `wide` steps the column up one size for
 * card layouts (Work) that need more room than prose.
 */
export function Section({
  id,
  label,
  labelNote,
  lede,
  wide = false,
  children,
}: {
  id: string;
  label: string;
  labelNote?: React.ReactNode;
  /** Optional one-paragraph intro, centered under the heading. */
  lede?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`mx-auto w-full px-6 py-16 md:py-24 ${wide ? "max-w-3xl" : "max-w-2xl"}`}
    >
      <div className="flex flex-col items-center text-center">
        <h2 className="font-heading text-title font-semibold text-foreground">{label}</h2>
        {labelNote ? (
          <p className="text-muted-foreground mt-2 font-mono text-xs">{labelNote}</p>
        ) : null}
        {lede ? (
          <p className="text-muted-foreground mt-5 max-w-measure text-base leading-relaxed">
            {lede}
          </p>
        ) : null}
      </div>
      <div className="mt-10 min-w-0 md:mt-12">{children}</div>
    </section>
  );
}
