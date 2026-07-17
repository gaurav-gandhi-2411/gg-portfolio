"use client";

import { useMemo, useState } from "react";
import { sampleIssues } from "@/content/tfidf-samples";

/**
 * A live-compute micro-moment on the TriageIQ work entry: a real TF-IDF
 * classifier, computed in the browser over the real sample corpus
 * (content/tfidf-samples.ts, 12 real currently-public GitHub issues,
 * sourced per-item). This mirrors TriageIQ's real first-stage technique
 * (TF-IDF) on the same two repos its published metric covers — it is
 * explicitly labeled below as an illustrative reproduction, NOT the
 * production model (no BGE+FAISS retrieval stage, no LightGBM resolution
 * estimate, no Groq synthesis, and only 12 sample docs vs. the real
 * gold-labeled eval set). Nothing here calls TriageIQ's live service or
 * fabricates a score. Promoted from wave 8's Lab 4 prototype
 * (reports/wave8-lab-2026-07-17.md); ships collapsed by default via
 * triageiq-classify-disclosure.tsx, GG's call to keep it clearly secondary
 * to the embedding-space visualization.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "is", "in", "on", "of", "to", "and", "or", "with", "for",
  "at", "by", "from", "this", "that", "it", "be", "when", "sometimes",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

// Build TF-IDF space once from the real fixed corpus.
function buildSpace() {
  const docs = sampleIssues.map((s) => tokenize(s.title));
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const N = docs.length;
  const idf = new Map<string, number>();
  for (const [term, count] of df) idf.set(term, Math.log(N / count) + 1);

  function vectorize(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    const vec = new Map<string, number>();
    for (const [term, count] of tf) {
      const weight = (count / tokens.length) * (idf.get(term) ?? Math.log(N + 1));
      vec.set(term, weight);
    }
    return vec;
  }

  function cosine(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0,
      na = 0,
      nb = 0;
    for (const v of a.values()) na += v * v;
    for (const v of b.values()) nb += v * v;
    for (const [term, va] of a) {
      const vb = b.get(term);
      if (vb) dot += va * vb;
    }
    return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
  }

  const docVectors = docs.map(vectorize);

  function centroid(repo: "k8s" | "vscode"): Map<string, number> {
    const idxs = sampleIssues.map((s, i) => (s.repo === repo ? i : -1)).filter((i) => i >= 0);
    const sum = new Map<string, number>();
    for (const i of idxs) {
      for (const [term, w] of docVectors[i]) sum.set(term, (sum.get(term) ?? 0) + w / idxs.length);
    }
    return sum;
  }

  return {
    classify(text: string) {
      const v = vectorize(tokenize(text));
      return {
        k8s: cosine(v, centroid("k8s")),
        vscode: cosine(v, centroid("vscode")),
      };
    },
  };
}

export function TriageiqClassifyToy() {
  const space = useMemo(() => buildSpace(), []);
  const [text, setText] = useState(sampleIssues[3].title);
  const [result, setResult] = useState<{ k8s: number; vscode: number } | null>(null);

  function classify(t: string) {
    setText(t);
    setResult(space.classify(t));
  }

  const winner = result ? (result.k8s >= result.vscode ? "k8s" : "vscode") : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {sampleIssues.map((s) => (
          <button
            key={s.number}
            type="button"
            onClick={() => classify(s.title)}
            className="border-border bg-card hover:border-accent/40 rounded-md border px-2.5 py-1 text-left font-mono text-xs"
            title={s.url}
          >
            {s.repo} #{s.number}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          classify(text);
        }}
        className="flex gap-2"
      >
        <label htmlFor="triageiq-classify-text" className="sr-only">
          Bug title to classify
        </label>
        <input
          id="triageiq-classify-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="border-border bg-card text-foreground w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground shrink-0 rounded-md px-4 py-2 text-sm font-medium"
        >
          Classify
        </button>
      </form>

      {result && (
        <div aria-live="polite" className="flex flex-col gap-2 text-sm">
          {(["k8s", "vscode"] as const).map((repo) => (
            <div key={repo} className="flex items-center gap-3">
              <span className="w-16 font-mono text-xs text-muted-foreground">{repo}</span>
              <div className="bg-border/40 h-[6px] flex-1 overflow-hidden rounded-full">
                <div
                  className={`h-full rounded-full ${repo === winner ? "bg-accent" : "bg-border"}`}
                  style={{ width: `${Math.max(2, result[repo] * 100)}%` }}
                />
              </div>
              <span className="w-14 text-right font-mono text-xs text-foreground">
                {result[repo].toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="text-muted-foreground max-w-[52ch] text-xs leading-relaxed">
        Illustrative reproduction only: real TF-IDF + cosine similarity, computed live in
        your browser over 12 real, sourced GitHub issue titles above (hover a button for
        its URL) — not TriageIQ&apos;s production model (no BGE+FAISS retrieval, no LightGBM,
        no Groq synthesis, and 12 docs vs. its real gold-labeled eval set). Production
        TriageIQ&apos;s real top-3 accuracy on these repos: 82.5% (k8s) / 90.4% (vscode).
      </p>
    </div>
  );
}
