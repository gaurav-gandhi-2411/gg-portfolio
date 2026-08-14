"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LinkButton } from "@/components/link-button";
import { Monogram } from "@/components/monogram";
import type { WarmupConfig } from "@/content/warmup";

const RETRY_GAP_MS = 1500;

type Phase = "idle" | "waking" | "success" | "failed";

/** A single fetch attempt against the health URL. no-cors mode means the
 * promise resolves for ANY completed round trip (any status code) and only
 * rejects on a real network failure or our own timeout — exactly the "is the
 * container up yet" signal, without needing the backend to opt into CORS.
 *
 * The attempt's own timeout must be generous, not a short poll interval:
 * Cloud Run serializes concurrent requests to the same cold-starting
 * instance (these services all run maxScale=1), so a genuinely cold ~20-90s
 * boot has to be waited out inside ONE attempt — aborting every few seconds
 * and retrying just restarts the wait against a boot that's still running
 * server-side regardless, and can push the observed wake time well past the
 * real one. */
async function probe(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function WarmupClient({ config }: { config: WarmupConfig }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  const failAfterMs = config.expectedWakeSeconds * 2 * 1000;

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const startWaking = useCallback(async () => {
    cancelledRef.current = false;
    startRef.current = Date.now();
    setElapsedMs(0);
    setPhase("waking");

    const tick = setInterval(() => {
      if (startRef.current !== null) {
        setElapsedMs(Date.now() - startRef.current);
      }
    }, 250);

    while (true) {
      if (cancelledRef.current) {
        clearInterval(tick);
        return;
      }
      const elapsed = startRef.current !== null ? Date.now() - startRef.current : 0;
      if (elapsed >= failAfterMs) {
        clearInterval(tick);
        if (!cancelledRef.current) setPhase("failed");
        return;
      }

      // Each attempt gets whatever's left of the overall budget — a single
      // attempt should be able to wait out the entire cold boot rather than
      // getting cut short by a fixed short poll interval (see probe()'s note).
      const remainingMs = failAfterMs - (Date.now() - (startRef.current ?? Date.now()));
      const ok = await probe(config.healthUrl, Math.max(remainingMs, 1000));
      if (cancelledRef.current) {
        clearInterval(tick);
        return;
      }
      if (ok) {
        clearInterval(tick);
        setPhase("success");
        setTimeout(() => {
          if (!cancelledRef.current) window.location.href = config.destinationUrl;
        }, 700);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, RETRY_GAP_MS));
    }
  }, [config, failAfterMs]);

  const elapsedSeconds = Math.floor(elapsedMs / 1000);

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-[var(--space-6)] py-32 text-center"
    >
      <Monogram className="mb-6 opacity-80" />
      <p className="text-muted-foreground font-mono text-caption tracking-eyebrow uppercase">
        Waking a demo
      </p>
      <h1 className="font-heading text-heading mt-[var(--space-4)] font-semibold text-foreground">
        {config.name} is asleep
      </h1>

      {phase === "idle" && (
        <>
          <p className="text-muted-foreground mt-[var(--space-4)] max-w-measure text-base leading-relaxed">
            This demo scales to zero when nobody&apos;s using it — $0 idle cost instead of paying
            for {config.gpuBacked ? "a GPU" : "a server"} to sit around 24/7. The tradeoff is a
            cold start: the first visit after a quiet stretch has to wait for it to spin back up,
            usually around {config.expectedWakeSeconds}s.
          </p>
          <button
            type="button"
            onClick={() => void startWaking()}
            className="bg-accent text-accent-foreground hover:shadow-card-hover focus-visible:outline-ring mt-[var(--space-8)] inline-flex items-center gap-[var(--space-2)] rounded-lg px-5 py-[var(--space-3)] text-sm font-medium transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            Wake the demo
          </button>
        </>
      )}

      {phase === "waking" && (
        <>
          <p className="text-muted-foreground mt-[var(--space-4)] max-w-measure text-base leading-relaxed">
            Waking {config.name}
            <span className="ml-1 inline-flex gap-[var(--space-1)] align-middle">
              <span className="typing-dot bg-muted-foreground inline-block h-1.5 w-1.5 rounded-full" />
              <span className="typing-dot bg-muted-foreground inline-block h-1.5 w-1.5 rounded-full" />
              <span className="typing-dot bg-muted-foreground inline-block h-1.5 w-1.5 rounded-full" />
            </span>
          </p>
          <p className="text-muted-foreground mt-[var(--space-2)] font-mono text-caption">
            {elapsedSeconds}s elapsed — usually ready around {config.expectedWakeSeconds}s
          </p>
        </>
      )}

      {phase === "success" && (
        <p className="mt-[var(--space-4)] max-w-measure text-base leading-relaxed text-foreground">
          Ready — taking you there now.
        </p>
      )}

      {phase === "failed" && (
        <>
          <p className="text-muted-foreground mt-[var(--space-4)] max-w-measure text-base leading-relaxed">
            Still no response after {Math.floor(failAfterMs / 1000)}s — longer than a cold start
            should take, so it&apos;s more likely down than just asleep.
          </p>
          <div className="mt-[var(--space-8)] flex flex-wrap items-center justify-center gap-[var(--space-4)]">
            <button
              type="button"
              onClick={() => void startWaking()}
              className="border-border/60 bg-card/60 text-foreground hover:border-accent/60 hover:bg-card focus-visible:outline-ring inline-flex items-center gap-[var(--space-2)] rounded-lg border px-[var(--space-4)] py-[var(--space-2-5)] text-sm font-medium transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              Try again
            </button>
            <LinkButton href={config.repoUrl}>View the source instead</LinkButton>
          </div>
        </>
      )}

      <p className="mt-[var(--space-10)] flex gap-[var(--space-6)] text-sm">
        <Link
          href="/"
          className="text-accent focus-visible:outline-ring font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          ← Home
        </Link>
        <Link
          href="/projects"
          className="text-accent focus-visible:outline-ring font-medium transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
          All projects →
        </Link>
      </p>
    </main>
  );
}
