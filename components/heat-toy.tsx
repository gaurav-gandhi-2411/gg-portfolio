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

// `found` is an explicit flag, not inferred from `sim`'s sign — cosine
// similarity is legitimately negative for two real, valid, dissimilar
// embeddings (verified live: "fire" scored -0.083 against one real secret
// word), so a bare `sim < 0` sentinel misreports a real match as "not in
// the word list" whenever the true similarity happens to be negative. Bug
// found during this wave's own QA of the headline feature, not introduced
// by it — pre-existing since the sentinel pattern shipped in wave 3.
function guessFeedback(entry: { word: string; sim: number; found: boolean }): {
  label: string;
  className: string;
} {
  if (!entry.found) return { label: "Not in the word list — try another", className: "text-muted-foreground" };
  return heatLabel(entry.sim);
}

// Plot geometry — internal SVG coordinate system, rendered responsively
// (viewBox + w-full) so it scales cleanly from 390px mobile up, unlike the
// wave-8 Lab 1 prototype's fixed-pixel width (that lab was desktop-only —
// production fixes this).
const PW = 320;
const PH = 190;
const PAD = 24;

export function HeatToy() {
  const [vocab, setVocab] = useState<VocabPayload | null>(null);
  const [error, setError] = useState(false);
  const [guess, setGuess] = useState("");
  const [history, setHistory] = useState<{ word: string; sim: number; found: boolean }[]>([]);
  const [won, setWon] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Wave 9 (GG-approved production integration of the wave-8 Lab 1
  // prototype — reports/wave8-lab-2026-07-17.md, the "highest-leverage"
  // pick): the guess is plotted in the real embedding space next to
  // today's secret word, not just labeled Cold/Warm/Hot. Both the plot
  // *and* the original text feedback below render from the same real
  // numbers — the visualization adds a channel, it doesn't replace the
  // accessible one.
  const [plotPos, setPlotPos] = useState<{ x: number; y: number } | null>(null);
  const [plotLabel, setPlotLabel] = useState<{ word: string; pc1: number; pc2: number; sim: number } | null>(
    null
  );
  const [stage, setStage] = useState<"idle" | "embedding" | "revealed">("idle");

  // retryNonce re-runs the effect when the visitor clicks "Try again" —
  // the wave-9 version fetched exactly once and parked on a permanent
  // error for any transient failure (mid-deploy blip, flaky mobile
  // connection), which is what GG hit on the live site. Rule 108: an
  // outbound call gets retries and a defined failure behavior, and the
  // failure behavior here is recoverable, not a dead end.
  const [retryNonce, setRetryNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const delays = [0, 500, 1500];
      for (const delay of delays) {
        if (delay) await new Promise((r) => setTimeout(r, delay));
        if (cancelled) return;
        try {
          const res = await fetch("/heat-toy-vocab.json");
          if (!res.ok) throw new Error("fetch failed");
          const data: VocabPayload = await res.json();
          if (!cancelled) setVocab(data);
          return;
        } catch {
          // fall through to the next backoff step
        }
      }
      if (!cancelled) setError(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [retryNonce]);

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

  // Real bounds of the real embedding space's first two components,
  // computed once from the full 410-word vocab — not arbitrary axis limits.
  const bounds = useMemo(() => {
    if (!vocab) return null;
    let min0 = Infinity,
      max0 = -Infinity,
      min1 = Infinity,
      max1 = -Infinity;
    for (const v of vocab.vectors) {
      const d0 = (v[0] / 255) * vocab.scale[0] + vocab.mins[0];
      const d1 = (v[1] / 255) * vocab.scale[1] + vocab.mins[1];
      if (d0 < min0) min0 = d0;
      if (d0 > max0) max0 = d0;
      if (d1 < min1) min1 = d1;
      if (d1 > max1) max1 = d1;
    }
    return { min0, max0, min1, max1 };
  }, [vocab]);

  function project(d0: number, d1: number) {
    if (!bounds) return { x: PW / 2, y: PH / 2 };
    const nx = (d0 - bounds.min0) / (bounds.max0 - bounds.min0 || 1);
    const ny = (d1 - bounds.min1) / (bounds.max1 - bounds.min1 || 1);
    return { x: PAD + nx * (PW - 2 * PAD), y: PH - PAD - ny * (PH - 2 * PAD) };
  }

  const secretPos = useMemo(() => {
    if (!vocab || secretIndex < 0) return null;
    const v = vocab.vectors[secretIndex];
    const d0 = (v[0] / 255) * vocab.scale[0] + vocab.mins[0];
    const d1 = (v[1] / 255) * vocab.scale[1] + vocab.mins[1];
    return project(d0, d1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocab, secretIndex, bounds]);

  function submitWord(raw: string) {
    if (!vocab || !secretVector) return;
    const word = raw.trim().toLowerCase();
    if (!word) return;

    const idx = vocab.words.indexOf(word);
    if (idx === -1) {
      setHistory((h) => [{ word, sim: 0, found: false }, ...h].slice(0, 6));
      setGuess("");
      return;
    }

    const guessVector = dequantize(vocab.vectors[idx], vocab.mins, vocab.scale);
    const sim = cosineSim(guessVector, secretVector);
    setHistory((h) => [{ word, sim, found: true }, ...h].slice(0, 6));
    setGuess("");
    if (idx === secretIndex) setWon(true);

    const v = vocab.vectors[idx];
    const d0 = (v[0] / 255) * vocab.scale[0] + vocab.mins[0];
    const d1 = (v[1] / 255) * vocab.scale[1] + vocab.mins[1];
    const target = project(d0, d1);

    // Staged reveal, disclosed as pacing, not a disguised wait — the cosine
    // sim above and this projection are both already computed (<5ms for
    // 410 words); the ~180ms hold + ~450ms transform transition is a
    // deliberate sequence so the guess visibly *arrives* at its real
    // position rather than popping there (reports/wave8-lab, Lab 1).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlotPos(target);
      setPlotLabel({ word, pc1: d0, pc2: d1, sim });
      setStage("revealed");
      return;
    }

    setStage("embedding");
    // First guess starts from the plot's neutral center; later guesses
    // carry over their previous position, so the point visibly moves
    // closer to or farther from the secret word guess-to-guess.
    setPlotPos((prev) => prev ?? { x: PW / 2, y: PH / 2 });
    window.setTimeout(() => {
      setPlotPos(target);
      setPlotLabel({ word, pc1: d0, pc2: d1, sim });
      setStage("revealed");
    }, 180);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitWord(guess);
  }

  // Two clickable starter guesses for first-time visitors (GG's wave-10
  // feedback: with a hidden word and no hint, a visitor has no idea how to
  // engage). Fixed offsets from the daily index keep the picks deterministic
  // per day and never equal to the secret (137 and 271 are not multiples of
  // the 410-word vocab size, so index + offset ≡ index is impossible).
  const starterWords = useMemo(() => {
    if (!vocab || secretIndex < 0) return [];
    const n = vocab.words.length;
    return [vocab.words[(secretIndex + 137) % n], vocab.words[(secretIndex + 271) % n]];
  }, [vocab, secretIndex]);

  if (error) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">
          Couldn&apos;t load the word list right now — or try{" "}
          <a href="https://playwarmer.vercel.app/" className="text-accent hover:underline">
            the real Warmer
          </a>{" "}
          instead.
        </p>
        <button
          type="button"
          onClick={() => {
            setError(false);
            setRetryNonce((n) => n + 1);
          }}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-card"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!vocab || !secretPos) {
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

      {history.length === 0 && starterWords.length > 0 && (
        <p className="text-sm text-muted-foreground">
          It&apos;s one of 410 everyday English words. Not sure where to start? Try{" "}
          {starterWords.map((w, i) => (
            <span key={w}>
              <button
                type="button"
                onClick={() => submitWord(w)}
                className="rounded-md border border-border bg-card px-2 py-0.5 font-mono text-xs text-foreground transition-colors hover:border-ring"
              >
                {w}
              </button>
              {i < starterWords.length - 1 ? " or " : ""}
            </span>
          ))}
          {" — the plot shows how close you land."}
        </p>
      )}

      <svg
        viewBox={`0 0 ${PW} ${PH}`}
        role="img"
        aria-label={
          plotLabel
            ? `${plotLabel.word} plotted at (${plotLabel.pc1.toFixed(2)}, ${plotLabel.pc2.toFixed(2)}), cosine similarity ${plotLabel.sim.toFixed(3)} against today's secret word`
            : "Embedding-space plot, no guess yet"
        }
        className="border-border/60 bg-background/40 h-auto w-full max-w-md rounded-md border"
      >
        <line x1={PAD} y1={PH - PAD} x2={PW - PAD} y2={PH - PAD} stroke="var(--border)" strokeWidth={1} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={PH - PAD} stroke="var(--border)" strokeWidth={1} />
        <text x={PW - PAD} y={PH - PAD + 14} textAnchor="end" fill="var(--text-lo)" fontSize={9} fontFamily="var(--font-jetbrains-mono)">
          PC1 →
        </text>
        <text x={PAD - 4} y={PAD - 8} textAnchor="start" fill="var(--text-lo)" fontSize={9} fontFamily="var(--font-jetbrains-mono)">
          ↑ PC2
        </text>

        {/* opacity 0.8, not eyeballed: --text-lo composited at 0.8 over
            --background computes to 4.55:1 (AA text floor is 4.5:1) —
            0.6 (the original value) only reached 3.03:1, caught by
            design review since it's a new derived color not in
            globals.css's own contrast table. */}
        <circle cx={secretPos.x} cy={secretPos.y} r={5} fill="var(--text-lo)" opacity={0.8} />
        <text x={secretPos.x + 9} y={secretPos.y + 3} fill="var(--text-lo)" fontSize={10} fontFamily="var(--font-jetbrains-mono)">
          today&apos;s word
        </text>

        {plotPos && (
          <line
            x1={secretPos.x}
            y1={secretPos.y}
            x2={plotPos.x}
            y2={plotPos.y}
            stroke="var(--indigo)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.5}
          />
        )}

        {plotPos && (
          <g
            className="transition-transform duration-[450ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
            style={{ transform: `translate(${plotPos.x}px, ${plotPos.y}px)` }}
          >
            <circle r={6} fill="var(--indigo)" />
            {plotLabel && (
              <text x={10} y={4} fill="var(--text-hi)" fontSize={11} fontFamily="var(--font-jetbrains-mono)">
                {plotLabel.word}
              </text>
            )}
          </g>
        )}
      </svg>

      <div aria-live="polite" className="flex flex-col gap-1.5">
        {stage === "embedding" && <p className="text-muted-foreground text-xs animate-pulse">embedding…</p>}
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
                {h.found && (
                  <span
                    className="block h-px bg-accent"
                    style={{ width: `${Math.max(2, Math.round(Math.max(0, h.sim) * 100))}%` }}
                  />
                )}
              </span>
              <span className={`shrink-0 font-mono ${feedback.className}`}>
                {h.found ? `${feedback.label} (${h.sim.toFixed(2)})` : feedback.label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground max-w-[52ch] text-xs leading-relaxed">
        The plot uses only the real embedding space&apos;s 1st and 2nd principal components
        (of 72 total, 72.3% variance retained) — a genuine but simplified 2D view. The
        Cold/Warm/Hot feedback above uses all 72 dimensions, same as always.
      </p>
    </div>
  );
}
