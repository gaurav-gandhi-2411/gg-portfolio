/**
 * Wave 11 section shell — one centered axis for the whole page. The h2 is
 * a centered, quiet heading; whitespace does the separation; content sits
 * in the same centered column.
 *
 * Wave 13 — the column widths gain a desktop step (GG's standing
 * complaint: at 1280–1600px the site read as a narrow column in a void).
 * Two widths:
 *   prose — unchanged reading column (About's text, Contact);
 *   wide  — steps up to 5xl at xl for sections with an internal desktop
 *           composition (Experience's meta rail, Research's two-column,
 *           the two-column project card grid).
 * ONE xl width for every widened section + the nav — the design review
 * blocked a first cut where Work sat at 6xl beside 5xl siblings: three
 * widths on one continuous page read as an accident, not a decision.
 * Mobile and tablet are untouched; prose measure inside wide sections is
 * still capped by each component (max-w-measure), so line length never
 * rides the container.
 */
const WIDTHS = {
  prose: "max-w-2xl",
  wide: "max-w-3xl xl:max-w-5xl",
} as const;

export function Section({
  id,
  label,
  labelNote,
  lede,
  width = "prose",
  children,
}: {
  id: string;
  label: string;
  labelNote?: React.ReactNode;
  /** Optional one-paragraph intro, centered under the heading. */
  lede?: React.ReactNode;
  width?: keyof typeof WIDTHS;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`mx-auto w-full px-6 py-16 md:py-24 ${WIDTHS[width]}`}>
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
