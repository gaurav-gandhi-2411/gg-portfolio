"use client";

import { useId, useRef, useState } from "react";
import { TransitionLink } from "@/components/transition-link";
import { cn } from "@/lib/utils";

/**
 * Wave 16 — the flagship RAG chatbot's actual chat UI, hosted on its own
 * page (app/ask/page.tsx). Talks directly to POST /api/chat
 * (app/api/chat/route.ts) — no new HTTP client, no client-side retrieval.
 *
 * Deliberately non-streaming (a backend scope decision, see route.ts's own
 * comment) — the loading state is a plain "Thinking…" indicator, not a
 * faked token stream.
 *
 * A "refused" answer (the API's own honest "I don't have grounded
 * information for that" response, `refused: true`) is a normal, expected
 * assistant turn — rendered as a quieter-styled bubble, not the error
 * state. The error state is reserved for the request itself failing:
 * a network error, or a response that doesn't even parse into the
 * documented { answer, citations, refused } shape (which would mean the
 * route crashed and Next served its own HTML error page instead of JSON —
 * genuinely unexpected, unlike a 400/429 with a well-formed body, see
 * below).
 */

interface Citation {
  sourceRef: string;
  label: string;
  url?: string;
}

interface ChatResponseBody {
  answer: string;
  citations: Citation[];
  refused: boolean;
}

interface ConversationTurn {
  question: string;
  answer: string;
  citations: Citation[];
  refused: boolean;
}

type Status = "idle" | "loading" | "error";

// Matches the route's own `maxDuration = 30` (app/api/chat/route.ts) — the
// client gives up at the same point the server would already have, so a
// timeout here always means "the server-side bound was hit or exceeded,"
// never "gave up early on a request that was about to succeed."
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * The four ways asking a question can genuinely fail, each with its own
 * honest, specific message — rather than one generic "check your
 * connection" that blames the user for a server fault. Rate-limit (429)
 * and no-answer (refused:true, 200) are NOT failure states: both are
 * well-formed answers from the route and render as normal conversation
 * turns, not this banner.
 */
const ERROR_MESSAGES: Record<"offline" | "timeout" | "server" | "network", string> = {
  offline: "You appear to be offline. Check your connection and try again.",
  timeout: "The assistant is taking longer than expected. Please try again in a moment.",
  server:
    "Something went wrong on our end reaching the assistant. It's been logged — please try again shortly.",
  network: "Couldn't reach the assistant — there may be a network issue. Please try again.",
};

// 4-5 starter questions spanning project depth, the debugging-story angle,
// and the two things a recruiter/hiring manager actually wants to know
// (background, availability) — sourced from content/case-studies/warmer.ts,
// content/case-studies/triageiq.ts, and content/availability.ts so every
// chip is genuinely answerable from the corpus, not a guess.
const SUGGESTED_QUESTIONS = [
  "What is Gaurav's current role and background?",
  "How does TriageIQ's four-stage pipeline work?",
  "What went wrong with Warmer's Hinglish model, and how was it fixed?",
  "What roles is Gaurav looking for right now?",
  "Which project's evaluation numbers are the most interesting?",
] as const;

/**
 * Parses a fetch Response body defensively against the documented
 * ChatResponseBody shape. Returns null if the body isn't valid JSON or
 * doesn't match the shape — the caller treats that as a genuine failure,
 * regardless of HTTP status. A 400 (bad input) or 429 (rate-limited)
 * response still carries a well-formed { answer, citations,
 * refused: true } body per route.ts, so those are NOT treated as errors
 * here — only a body that fails to parse at all (e.g. Next's own HTML
 * error page for an unhandled 500) is.
 */
async function parseChatResponse(res: Response): Promise<ChatResponseBody | null> {
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return null;
  }
  if (
    typeof raw !== "object" ||
    raw === null ||
    typeof (raw as { answer?: unknown }).answer !== "string" ||
    !Array.isArray((raw as { citations?: unknown }).citations)
  ) {
    return null;
  }
  const body = raw as ChatResponseBody;
  return { answer: body.answer, citations: body.citations, refused: Boolean(body.refused) };
}

export function AskPanel() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [errorKind, setErrorKind] = useState<keyof typeof ERROR_MESSAGES>("network");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  async function ask(rawQuestion: string): Promise<void> {
    const trimmed = rawQuestion.trim();
    if (!trimmed || status === "loading") return;

    setStatus("loading");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
        signal: controller.signal,
      });

      // A 5xx means the route itself faulted (app/api/chat/route.ts wraps
      // its pipeline in try/catch and always returns well-formed JSON on
      // this path — see serverErrorAnswer() — but the status is what marks
      // it as a fault rather than a normal in-band answer/refusal/rate-limit
      // turn). Distinct from every other failure mode: this one is ours.
      if (res.status >= 500) {
        setErrorKind("server");
        setStatus("error");
        return;
      }

      const body = await parseChatResponse(res);
      if (!body) {
        // The response didn't even parse into the documented shape —
        // unexpected regardless of status code, so treat it the same as a
        // declared server fault rather than a transport failure.
        setErrorKind("server");
        setStatus("error");
        return;
      }

      setTurns((prev) => [...prev, { question: trimmed, ...body }]);
      setQuestion("");
      setStatus("idle");
    } catch (err) {
      // Keep the typed question in place so retrying is a single click on
      // Ask, not a retype — every case here is a transport failure, not a
      // rejected question.
      if (err instanceof DOMException && err.name === "AbortError") {
        setErrorKind("timeout");
      } else if (typeof navigator !== "undefined" && !navigator.onLine) {
        setErrorKind("offline");
      } else {
        setErrorKind("network");
      }
      setStatus("error");
    } finally {
      clearTimeout(timeoutId);
      // Focus stays in the input throughout (rule 15a: sensible focus
      // management, never yanked around) — whether the turn succeeded,
      // was refused, or the request errored, the next thing a keyboard
      // user wants is to type again.
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    void ask(question);
  }

  /** Populates the input from a suggested-question chip and keeps focus
   * there, so a keyboard user can immediately edit or press Enter. */
  function handlePickSuggestion(q: string): void {
    setQuestion(q);
    inputRef.current?.focus();
  }

  const isEmpty = turns.length === 0 && status !== "loading";

  return (
    <div className="flex flex-col gap-6">
      <div
        aria-live="polite"
        className="border-border/60 bg-card/40 flex min-h-[16rem] flex-col gap-5 rounded-xl border p-5"
      >
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
            <p className="text-muted-foreground max-w-measure text-sm leading-relaxed">
              Ask a question, or try one of these:
            </p>
            <ChipRow onPick={handlePickSuggestion} />
          </div>
        ) : (
          <ol className="flex flex-col gap-5">
            {turns.map((turn, i) => (
              <li key={i} className="flex flex-col gap-3">
                <p className="text-foreground self-end rounded-xl rounded-br-sm bg-secondary px-4 py-2.5 text-sm font-medium">
                  {turn.question}
                </p>
                <div
                  className={cn(
                    "flex flex-col gap-2 rounded-xl rounded-bl-sm border px-4 py-3 text-sm leading-relaxed",
                    turn.refused
                      ? "border-border/60 bg-transparent text-muted-foreground"
                      : "border-border/60 bg-card text-foreground"
                  )}
                >
                  <p>{turn.answer}</p>
                  {turn.citations.length > 0 ? (
                    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/40 pt-2">
                      {turn.citations.map((c) => (
                        <li key={c.sourceRef} className="font-mono text-xs">
                          {c.url ? (
                            <TransitionLink
                              href={c.url}
                              className="text-accent focus-visible:outline-ring underline decoration-1 underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
                            >
                              {c.label}
                            </TransitionLink>
                          ) : (
                            <span className="text-muted-foreground">{c.label}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
            {status === "loading" ? (
              <li className="text-muted-foreground self-start rounded-xl rounded-bl-sm border border-border/60 px-4 py-3 text-sm">
                Thinking…
              </li>
            ) : null}
          </ol>
        )}
      </div>

      {status === "error" ? (
        <p role="alert" className="text-destructive text-sm">
          {ERROR_MESSAGES[errorKind]}
        </p>
      ) : null}

      {!isEmpty ? <ChipRow onPick={handlePickSuggestion} compact /> : null}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Ask a question about Gaurav&apos;s work
        </label>
        <input
          id={inputId}
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about a project, the architecture, or what I'm looking for…"
          autoComplete="off"
          className="border-border bg-card text-foreground focus-visible:ring-ring/50 focus-visible:border-ring w-full rounded-md border px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2"
        />
        <button
          type="submit"
          disabled={status === "loading" || question.trim().length === 0}
          className="bg-accent text-accent-foreground shrink-0 rounded-md px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

function ChipRow({
  onPick,
  compact = false,
}: {
  onPick: (question: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-2",
        compact ? "justify-start" : "justify-center"
      )}
    >
      {SUGGESTED_QUESTIONS.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onPick(q)}
          className="border-border bg-card hover:border-accent/40 hover:text-foreground text-muted-foreground rounded-full border px-3 py-1.5 text-left text-xs transition-colors motion-reduce:transition-none"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
