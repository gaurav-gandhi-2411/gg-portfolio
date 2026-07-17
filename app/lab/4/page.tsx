import { TfidfClassifyToy } from "@/components/lab/tfidf-classify-toy";

export default function Lab4() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-muted-foreground text-xs uppercase tracking-eyebrow">Lab 4</p>
      <h1 className="font-heading text-title mt-2 font-semibold">Live TF-IDF classify</h1>
      <p className="text-muted-foreground mt-3 max-w-[62ch] text-sm leading-relaxed">
        Pick a real GitHub issue title (or type your own bug report) and watch a real
        TF-IDF classifier — run live in your browser — score it against k8s vs. vscode,
        the same two repos TriageIQ&apos;s published accuracy figure covers.
      </p>
      <div className="mt-10">
        <TfidfClassifyToy />
      </div>
    </main>
  );
}
