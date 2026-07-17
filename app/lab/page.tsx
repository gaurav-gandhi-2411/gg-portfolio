const LABS = [
  {
    n: 1,
    title: "Embedding-space visualization as loading state",
    desc: "The heat toy's guess plotted for real, in the actual PCA-reduced embedding space — not a spinner.",
  },
  {
    n: 2,
    title: "Staggered stream-in reveal",
    desc: "Per-element 40-60ms cascade, modeled on modern AI-product reveal patterns.",
  },
  {
    n: 3,
    title: "Modern momentum slider",
    desc: "Drag/scroll-snap with magnetic alignment, peek-of-next, and a fraction-counter progress indicator.",
  },
  {
    n: 4,
    title: "Live TF-IDF classify",
    desc: "A small real TF-IDF classifier, run client-side, over real sourced sample titles — mirrors TriageIQ's technique.",
  },
  {
    n: 5,
    title: "Scroll-linked eval-figure draw-in",
    desc: "Wave 7's real eval figures animate from 0 to their real value as they enter view.",
  },
];

export default function LabIndex() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-heading text-title font-semibold">Wave 8 — five prototypes</h1>
      <p className="text-muted-foreground mt-3 max-w-[62ch] text-sm leading-relaxed">
        Isolated demos, not a reskin. Each uses real data/computation from the actual site.
        Not for merge — GG picks which advance.
      </p>
      <ul className="mt-10 flex flex-col gap-6">
        {LABS.map((l) => (
          <li key={l.n} className="border-border/40 border-t pt-6 first:border-t-0 first:pt-0">
            <a href={`/lab/${l.n}`} className="font-heading text-lead font-semibold hover:text-accent">
              {l.n}. {l.title}
            </a>
            <p className="text-muted-foreground mt-1 max-w-[62ch] text-sm leading-relaxed">
              {l.desc}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
