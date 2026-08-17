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
 *
 * UI/UX wave (2026-07-30) — the complaint kept recurring after wave 13
 * because the step itself started at xl (1280px): 1024–1279px (a common
 * laptop band, and exactly the 1024px breakpoint this audit was asked to
 * cover) got the *tablet* layout, not the desktop one. The step now starts
 * at lg (1024px) instead — same "one shared width" system, same 5xl cap,
 * just triggered one breakpoint earlier. Every component keyed off this
 * width's old `xl:` toggles (Experience, About, Research, the project
 * grid, case-study-page, site-nav) moved to `lg:` in lockstep.
 */
const WIDTHS = {
  prose: "max-w-2xl",
  wide: "max-w-3xl lg:max-w-5xl",
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
    <section id={id} className={`mx-auto w-full px-[var(--space-6)] py-16 md:py-24 ${WIDTHS[width]}`}>
      <div className="flex flex-col items-center text-center">
        <h2 className="font-heading text-title font-semibold text-foreground">{label}</h2>
        {/*
         * The one mark every section shares. Before this, a section was a
         * centered serif line and then content, so five sections down the page
         * read as five paragraphs of different lengths rather than five
         * sections: nothing said "a new thing starts here" except whitespace,
         * which the long ones (Experience at 1700px tall) swallowed.
         *
         * Deliberately the page's own accent and nothing else. A per-section
         * colour would compete with the case-study template, which already
         * spends thirteen derived hues off this token (see globals.css's
         * --accent-h note), and the point here is that the sections are one
         * system rather than thirteen.
         *
         * Static, not animated. It is small enough that a draw-in would be
         * motion nobody asked for, and it means reduced-motion visitors get
         * the identical composition rather than a flattened one.
         */}
        <span aria-hidden className="section-rule mt-[var(--space-4)]" />
        {labelNote ? (
          <p className="text-muted-foreground mt-[var(--space-4)] font-mono text-caption">{labelNote}</p>
        ) : null}
        {lede ? (
          <p className="text-muted-foreground mt-[var(--space-5)] max-w-measure text-base leading-relaxed">
            {lede}
          </p>
        ) : null}
      </div>
      <div className="mt-[var(--space-10)] min-w-0 md:mt-[var(--space-12)]">{children}</div>
    </section>
  );
}
