"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface VocabPayload {
  v: number;
  dims: number;
  mins: number[];
  scale: number[];
  words: string[];
  vectors: number[][];
}

function dequantize(vec: number[], mins: number[], scale: number[]): Float32Array {
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    out[i] = (vec[i] / 255) * scale[i] + mins[i];
  }
  return out;
}

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Deterministic daily pick — same word for everyone on the same UTC date, no server round-trip. */
function pickDailyIndex(seedStr: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % count;
}

function heatLabel(sim: number): { label: string; className: string } {
  if (sim > 0.75) return { label: "🔥 Scorching", className: "text-accent" };
  if (sim > 0.55) return { label: "Hot", className: "text-accent" };
  if (sim > 0.35) return { label: "Warm", className: "text-foreground" };
  if (sim > 0.15) return { label: "Cool", className: "text-muted-foreground" };
  return { label: "Cold", className: "text-muted-foreground" };
}

function guessFeedback(entry: { word: string; sim: number }): { label: string; className: string } {
  if (entry.sim < 0) return { label: "Not in the word list — try another", className: "text-muted-foreground" };
  return heatLabel(entry.sim);
}

export function HeatToy() {
  const [vocab, setVocab] = useState<VocabPayload | null>(null);
  const [error, setError] = useState(false);
  const [guess, setGuess] = useState("");
  const [history, setHistory] = useState<{ word: string; sim: number }[]>([]);
  const [won, setWon] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/heat-toy-vocab.json")
      .then((res) => {
        if (!res.ok) throw new Error("fetch failed");
        return res.json();
      })
      .then((data: VocabPayload) => {
        if (!cancelled) setVocab(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const secretIndex = useMemo(() => {
    if (!vocab) return -1;
    const today = new Date().toISOString().slice(0, 10);
    return pickDailyIndex(today, vocab.words.length);
  }, [vocab]);

  const secretVector = useMemo(() => {
    if (!vocab || secretIndex < 0) return null;
    return dequantize(vocab.vectors[secretIndex], vocab.mins, vocab.scale);
  }, [vocab, secretIndex]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vocab || !secretVector) return;
    const word = guess.trim().toLowerCase();
    if (!word) return;

    const idx = vocab.words.indexOf(word);
    if (idx === -1) {
      setHistory((h) => [{ word, sim: -1 }, ...h].slice(0, 6));
      setGuess("");
      return;
    }

    const guessVector = dequantize(vocab.vectors[idx], vocab.mins, vocab.scale);
    const sim = cosineSim(guessVector, secretVector);
    setHistory((h) => [{ word, sim }, ...h].slice(0, 6));
    setGuess("");
    if (idx === secretIndex) setWon(true);
  }

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn&apos;t load the word list right now — try{" "}
        <a href="https://playwarmer.vercel.app/" className="text-accent hover:underline">
          the real Warmer
        </a>{" "}
        instead.
      </p>
    );
  }

  if (!vocab) {
    return <p className="text-sm text-muted-foreground">Loading today&apos;s word…</p>;
  }

  // Intro copy lives once, in the Work section's annex — rendering it here
  // too duplicated the paragraph the moment the toy loaded (wave-6 audit bug).
  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="heat-toy-input" className="sr-only">
          Guess today&apos;s word
        </label>
        <input
          ref={inputRef}
          id="heat-toy-input"
          type="text"
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          disabled={won}
          placeholder="Your guess…"
          autoComplete="off"
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <button
          type="submit"
          disabled={won}
          className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-80 disabled:opacity-50"
        >
          Guess
        </button>
      </form>

      <div aria-live="polite" className="flex flex-col gap-1.5">
        {won && (
          <p className="text-sm font-medium text-accent">
            🎉 That&apos;s it — you found today&apos;s word.
          </p>
        )}
        {history.map((h, i) => {
          const feedback = guessFeedback(h);
          return (
            <div key={`${h.word}-${i}`} className="flex items-center gap-3 text-xs">
              <span className="w-24 shrink-0 truncate font-mono text-foreground">{h.word}</span>
              {/* The similarity, made visible — this row IS the demo. */}
              <span aria-hidden className="h-px flex-1 bg-border/40">
                {h.sim >= 0 && (
                  <span
                    className="block h-px bg-accent"
                    style={{ width: `${Math.max(2, Math.round(h.sim * 100))}%` }}
                  />
                )}
              </span>
              <span className={`shrink-0 font-mono ${feedback.className}`}>
                {h.sim >= 0 ? `${feedback.label} (${h.sim.toFixed(2)})` : feedback.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
