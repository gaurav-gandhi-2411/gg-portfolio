/**
 * Wave 6 section shell — the page's composition primitive. One container
 * (max-w-5xl), one shared left edge, and on desktop a label column + content
 * column so the dark canvas is occupied by structure instead of a single
 * centered strip (the wave-6 audit's core finding). The h2 lives in the
 * label column; the document outline stays flat and correct.
 */
export function Section({
  id,
  label,
  labelNote,
  children,
}: {
  id: string;
  label: string;
  labelNote?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-5xl px-6 py-12 md:py-16">
      <div className="border-border/40 border-t pt-8 md:grid md:grid-cols-[10rem_1fr] md:gap-x-16">
        {/* Outer div stretches with the row so the inner block can stay
            sticky while the section's content scrolls past. */}
        <div className="mb-6 md:mb-0">
          <div className="md:sticky md:top-12">
            <h2 className="font-heading text-lead font-semibold text-foreground">{label}</h2>
            {labelNote ? (
              <p className="text-muted-foreground mt-2 font-mono text-xs">{labelNote}</p>
            ) : null}
          </div>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
