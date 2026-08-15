"use client";

import { useEffect, useId, useRef, useState } from "react";
import { TransitionLink } from "@/components/transition-link";
import { cn } from "@/lib/utils";

/**
 * Wave 16 — the flagship RAG chatbot's actual chat UI, hosted on its own
 * page (app/ask/page.tsx). Talks directly to POST /api/chat
 * (app/api/chat/route.ts) — no new HTTP client, no client-side retrieval.
 *
 * Deliberately non-streaming server-side (a backend scope decision, see
 * route.ts's own comment — citation validation has to run to completion
 * before anything reaches the client, so there is no partial answer that's
 * safe to show early). UI/UX wave (2026-07-30): the already-complete,
 * already-validated answer now reveals progressively on the client
 * (useAnswerReveal, below) instead of appearing all at once — reads like a
 * real response arriving, without ever risking showing text that citation
 * validation would later have stripped. A real answer is never faked or
 * altered by this — same bytes, paced reveal.
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

/**
 * "unavailable" is deliberately NOT a kind of "error".
 *
 * An error invites a retry — the copy says "try again shortly" and the composer
 * stays open. When the local embedding dependency is absent (HTTP 503,
 * `unavailable: true`), retrying cannot succeed and no question the reader types
 * will ever be answered. A chatbot that keeps accepting input it cannot serve is
 * worse than one that visibly declines it, so this state closes the composer and
 * hides the suggested questions rather than dangling prompts that go nowhere.
 */
type Status = "idle" | "loading" | "error" | "unavailable";

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

// Characters revealed per tick and the tick interval — tuned for a natural
// reading pace (~190 chars/sec), fast enough that a long answer never feels
// like it's dragging, slow enough to read as arriving rather than a jump-cut.
const REVEAL_CHARS_PER_TICK = 4;
const REVEAL_INTERVAL_MS = 21;

/**
 * Reveals `fullText` a few characters at a time when `shouldAnimate` is
 * true, or returns it whole immediately otherwise (including under
 * prefers-reduced-motion, checked once per mount here rather than via CSS
 * since this drives actual text content, not just a visual transition).
 * The effect's dependency array is exactly [fullText, shouldAnimate] — a
 * parent re-render that doesn't change either (e.g. typing in the input
 * box while a past turn's `shouldAnimate` prop is still computed as the
 * same boolean it was last render) does NOT restart or affect an
 * already-running or already-finished reveal.
 */
function useAnswerReveal(fullText: string, shouldAnimate: boolean): string {
  // This hook only ever mounts client-side in response to a user action
  // (turns starts empty; nothing here renders during SSR or first paint),
  // so reading matchMedia directly during render — rather than in an
  // effect — is safe and avoids a render where the wrong choice was made
  // before an effect could correct it.
  const shouldReallyAnimate =
    shouldAnimate &&
    typeof window !== "undefined" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const [revealed, setRevealed] = useState(() => (shouldReallyAnimate ? "" : fullText));

  useEffect(() => {
    if (!shouldReallyAnimate) return;
    let shown = 0;
    const id = setInterval(() => {
      shown += REVEAL_CHARS_PER_TICK;
      setRevealed(shown >= fullText.length ? fullText : fullText.slice(0, shown));
      if (shown >= fullText.length) clearInterval(id);
    }, REVEAL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fullText, shouldReallyAnimate]);

  // Derived directly from shouldReallyAnimate rather than trusted-forever
  // state — if a newer turn appends mid-animation (shouldAnimate flips to
  // false), this immediately reflects the full text with no extra effect.
  return shouldReallyAnimate ? revealed : fullText;
}

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
    // "unavailable" is terminal for this mount: the composer is disabled, but
    // guard the handler too so a stray Enter or a programmatic submit cannot
    // fire a request that is guaranteed to 503.
    if (!trimmed || status === "loading" || status === "unavailable") return;

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
      // 503 = the feature cannot run at all (embedding dependency absent), not
      // a fault. Checked BEFORE the >=500 branch, which would otherwise class
      // it as a retryable server error and keep the composer open.
      if (res.status === 503) {
        setStatus("unavailable");
        return;
      }

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

  // Follow-ups (below) exclude anything already asked so the same chip
  // never reoffers a question the visitor just got an answer to. Hidden
  // entirely once the fixed catalog is exhausted rather than repeating —
  // this is a small curated set, not an infinite generator.
  const askedQuestions = new Set(turns.map((t) => t.question));
  const remainingQuestions = SUGGESTED_QUESTIONS.filter((q) => !askedQuestions.has(q));

  return (
    <div className="flex flex-col gap-6">
      <div
        aria-live="polite"
        className="border-border/60 bg-card/40 flex min-h-[16rem] flex-col gap-5 rounded-xl border p-5"
      >
        {isEmpty && status === "unavailable" ? (
          // A 503 adds no turn, so isEmpty stays true and this empty state is
          // what an unavailable visitor actually sees. Gating only the
          // post-turn chip row below left five suggested questions on screen
          // that could never be answered — the precise "looks like it works,
          // returns nothing" failure this state exists to prevent. Caught by
          // looking at a screenshot; the first version of the e2e test asserted
          // on the OTHER chip block's copy and passed straight through it.
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
            <p className="text-muted-foreground max-w-measure text-sm leading-relaxed">
              The assistant can&apos;t take questions right now.
            </p>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-6 text-center">
            <p className="text-muted-foreground max-w-measure text-sm leading-relaxed">
              Ask a question, or try one of these:
            </p>
            <ChipRow questions={SUGGESTED_QUESTIONS} onPick={handlePickSuggestion} />
          </div>
        ) : (
          <ol className="flex flex-col gap-5">
            {turns.map((turn, i) => (
              <li key={i} className="message-in flex flex-col gap-3">
                <p className="text-foreground self-end rounded-xl rounded-br-sm bg-secondary px-4 py-2.5 text-sm font-medium">
                  {turn.question}
                </p>
                <TurnAnswer turn={turn} shouldAnimate={i === turns.length - 1} />
              </li>
            ))}
            {status === "loading" ? (
              <li className="message-in text-muted-foreground self-start rounded-xl rounded-bl-sm border border-border/60 px-4 py-3 text-sm">
                <span className="sr-only">Thinking…</span>
                <span aria-hidden="true" className="flex items-center gap-1 py-0.5">
                  <span className="typing-dot bg-muted-foreground inline-block h-1.5 w-1.5 rounded-full" />
                  <span className="typing-dot bg-muted-foreground inline-block h-1.5 w-1.5 rounded-full" />
                  <span className="typing-dot bg-muted-foreground inline-block h-1.5 w-1.5 rounded-full" />
                </span>
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

      {/* Not text-destructive: this is not an error the reader caused or can
          act on, and styling it as one implies something is broken for them
          specifically. Muted, factual, and it points at what IS available. */}
      {status === "unavailable" ? (
        <p role="status" data-testid="ask-unavailable" className="text-muted-foreground text-sm">
          Ask is temporarily unavailable — the local search model didn&apos;t load. Everything it
          can tell you is on this page and in the case studies.
        </p>
      ) : null}

      {/* Chips are HIDDEN, not disabled, when unavailable — offering questions
          that cannot be answered is the "looks like it works, returns nothing"
          failure this state exists to avoid. */}
      {!isEmpty &&
      status !== "loading" &&
      status !== "unavailable" &&
      remainingQuestions.length > 0 ? (
        <div className="message-in flex flex-col gap-2">
          <p className="text-muted-foreground text-xs">Or ask about:</p>
          <ChipRow questions={remainingQuestions} onPick={handlePickSuggestion} compact />
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          Ask a question about Gaurav&apos;s work
        </label>
        <input
          id={inputId}
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={status === "unavailable"}
          placeholder={
            status === "unavailable"
              ? "Ask is unavailable right now"
              : "Ask about a project, the architecture, or what I'm looking for…"
          }
          autoComplete="off"
          className="border-border bg-card text-foreground focus-visible:ring-ring/50 focus-visible:border-ring min-h-11 w-full rounded-md border px-3 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2"
        />
        <button
          type="submit"
          disabled={
            status === "loading" || status === "unavailable" || question.trim().length === 0
          }
          className="bg-accent text-accent-foreground focus-visible:outline-ring min-h-11 shrink-0 rounded-md px-4 py-2.5 text-sm font-medium transition-[transform,box-shadow] duration-200 ease-out hover:enabled:-translate-y-0.5 hover:enabled:shadow-card-hover active:enabled:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:hover:enabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

/**
 * One conversation turn's assistant bubble. Reveals `turn.answer`
 * progressively via useAnswerReveal when it's the newest turn (see that
 * hook's own doc comment for why re-renders can't restart or disturb an
 * in-progress or finished reveal). Citations wait for the reveal to finish
 * before appearing — showing "what this is grounded in" before the answer
 * itself has finished arriving would read backwards.
 */
function TurnAnswer({
  turn,
  shouldAnimate,
}: {
  turn: ConversationTurn;
  shouldAnimate: boolean;
}) {
  const revealed = useAnswerReveal(turn.answer, shouldAnimate);
  const isFullyRevealed = revealed.length === turn.answer.length;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-xl rounded-bl-sm border px-4 py-3 text-sm leading-relaxed",
        turn.refused
          ? "border-border/60 bg-transparent text-muted-foreground"
          : "border-border/60 bg-card text-foreground"
      )}
    >
      {/* The animated paragraph updates every ~21ms while revealing, which
          would otherwise spam a screen reader with dozens of partial-text
          announcements from the ancestor aria-live region — hidden from
          the accessibility tree entirely. The sr-only paragraph carries the
          complete, final answer from the start, so AT users get one atomic
          announcement immediately, same as before this reveal existed. */}
      <p aria-hidden="true">{revealed}</p>
      <p className="sr-only">{turn.answer}</p>
      {turn.citations.length > 0 && isFullyRevealed ? (
        <ul className="message-in mt-1 flex flex-wrap gap-x-4 gap-y-1 border-t border-border/40 pt-2">
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
  );
}

function ChipRow({
  questions,
  onPick,
  compact = false,
}: {
  questions: readonly string[];
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
      {questions.map((q) => (
        <button
          key={q}
          type="button"
          // Marks every suggestion chip regardless of which block renders it,
          // so a test can assert "no suggestions are offered" without knowing
          // which container it came from — the gap that let five visible chips
          // through the degraded-state test.
          data-testid="ask-suggestion"
          onClick={() => onPick(q)}
          className="border-border bg-card hover:border-accent/40 hover:text-foreground text-muted-foreground focus-visible:outline-ring min-h-11 rounded-full border px-3 py-1.5 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
