import { EmbeddingPlotToy } from "@/components/lab/embedding-plot-toy";

export default function Lab1() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-muted-foreground text-xs uppercase tracking-eyebrow">Lab 1</p>
      <h1 className="font-heading text-title mt-2 font-semibold">
        Embedding-space visualization as a loading state
      </h1>
      <p className="text-muted-foreground mt-3 max-w-[62ch] text-sm leading-relaxed">
        Same real vocab and cosine-similarity engine as the production heat toy — but
        instead of a Cold/Warm/Hot label alone, your guess is plotted in the actual
        embedding space next to today&apos;s secret word, and moves there in a deliberate
        450ms reveal.
      </p>
      <div className="mt-10">
        <EmbeddingPlotToy />
      </div>
    </main>
  );
}
