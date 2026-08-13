// Wave 16 — the first Route Handler in this codebase: retrieval-augmented
// chat over GG's portfolio content. Node.js runtime (the default — no
// `export const runtime = "edge"`), since this route needs the local ONNX
// embedding pipeline (lib/chatbot/embed.mjs, via @huggingface/transformers)
// and Node's `fetch`/`process.env`, none of which the edge runtime is
// required for here and current Vercel guidance treats Node as the correct
// default for this shape of workload.
//
// Deliberately non-streaming: citation validation (below) must run to
// completion server-side before anything reaches the client, so there is no
// partial response to stream — this is a scope decision, not an oversight.
//
// Defense-in-depth against off-topic questions and prompt injection:
//   1. Retrieval refusal gate (RETRIEVAL_THRESHOLD, see lib/chatbot/retrieve.ts)
//      — catches most off-topic/injection attempts before any LLM call.
//   2. The system prompt's own "reference data only, never instructions" framing
//      around retrieved context, plus its "decline anything out of scope" rule.
//   3. Server-side citation validation below — any sourceRef the model cites
//      that wasn't actually in *this* request's retrieved context is stripped;
//      if everything gets stripped, the whole response downgrades to an
//      honest refusal rather than returning an uncited claim.

import { NextRequest, NextResponse } from "next/server";
import { getCache } from "@vercel/functions";
import { retrieve, RETRIEVAL_THRESHOLD } from "@/lib/chatbot/retrieve";
import { groqProvider } from "@/lib/chatbot/llm-provider";
import {
  buildAnswer,
  buildSystemPrompt,
  buildUserPrompt,
  refusalAnswer,
  serverErrorAnswer,
  unavailableAnswer,
  type ChatAnswer,
} from "@/lib/chatbot/answer";

const MAX_QUESTION_LENGTH = 500;

// Bounds worst-case latency (cold-start local embedding load + retrieval +
// the Groq call) well under Vercel's 300s function default — a chat demo
// has no business holding a request open that long, and this gives the
// client's own AbortController timeout (components/chatbot/ask-panel.tsx)
// something to race against that the function itself also enforces.
export const maxDuration = 30;

// Portfolio demo traffic, not a production API with paying users — 10
// requests per 10-minute window per client is generous for a real visitor
// asking a handful of questions while comfortably bounding worst-case Groq
// spend from one abusive client.
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

/**
 * Vercel sets `x-forwarded-for` to a comma-separated client,proxy,... chain;
 * the first entry is the original client IP. Falls back to a fixed key for
 * local dev, where the header is typically absent.
 */
function getClientKey(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim();
  return ip && ip.length > 0 ? ip : "local-dev";
}

/**
 * Best-effort rate limit check via Vercel Runtime Cache. NOT a strict atomic
 * counter (a `get` then `set` race is possible under concurrent requests from
 * the same client) — acceptable for a low-traffic portfolio demo, not a hard
 * security boundary. Sliding-window-ish: every allowed request refreshes the
 * TTL, so the window only fully resets after `RATE_LIMIT_WINDOW_SECONDS` of
 * client inactivity rather than on a fixed clock boundary.
 * @returns true if the request is allowed, false if the client is over budget
 */
async function checkRateLimit(key: string): Promise<boolean> {
  try {
    const cache = getCache();
    const cacheKey = `chat-rate-limit:${key}`;
    const current = await cache.get(cacheKey);
    const count = typeof current === "number" ? current : 0;
    if (count >= RATE_LIMIT_MAX_REQUESTS) return false;
    await cache.set(cacheKey, count + 1, { ttl: RATE_LIMIT_WINDOW_SECONDS });
    return true;
  } catch (err) {
    // Fail open: a broken cache must never take the whole endpoint down —
    // this is best-effort abuse mitigation, not a correctness requirement.
    console.warn(`[chat] rate limit check failed, allowing request — ${(err as Error).message}`);
    return true;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ChatAnswer>> {
  const startedAt = Date.now();
  const requestId = crypto.randomUUID(); // ephemeral, not tied to IP/client identity

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(refusalAnswer(), { status: 400 });
  }

  const question =
    typeof body === "object" && body !== null && "question" in body
      ? (body as { question: unknown }).question
      : undefined;

  if (
    typeof question !== "string" ||
    question.trim().length === 0 ||
    question.length > MAX_QUESTION_LENGTH
  ) {
    return NextResponse.json(
      {
        answer: `Please ask a non-empty question under ${MAX_QUESTION_LENGTH} characters.`,
        citations: [],
        refused: true,
      },
      { status: 400 }
    );
  }

  const clientKey = getClientKey(request);
  const allowed = await checkRateLimit(clientKey);
  if (!allowed) {
    return NextResponse.json(
      {
        answer: "You've hit the question limit for this demo — please try again in a few minutes.",
        citations: [],
        refused: true,
      },
      { status: 429 }
    );
  }

  // Everything from here on can throw for reasons that have nothing to do
  // with the question itself (the local embedding pipeline failing to load,
  // a Groq client exception escaping its own fail-soft wrapper, a future
  // regression) — a genuine server fault, not a "can't answer that"
  // refusal. Without this boundary, an uncaught exception here means Next
  // renders its own HTML error page instead of JSON, which is exactly what
  // ask-panel.tsx's fetch can't parse — surfacing as the client's generic
  // "check your connection" message for what is actually a server bug.
  // Catching it here keeps every response well-formed JSON and logs the
  // real exception (message + stack) against requestId so a report of "the
  // assistant is broken" is diagnosable from `vercel logs` alone, no repro
  // needed.
  try {
    const { chunks, maxScore } = await retrieve(question);
    const retrievedSourceRefs = chunks.map((c) => c.sourceRef);

    // Refusal gate: below threshold (or nothing retrieved), refuse without
    // spending an LLM call at all — the honest answer and the cheap answer
    // are the same answer here.
    if (chunks.length === 0 || maxScore < RETRIEVAL_THRESHOLD) {
      console.log(
        JSON.stringify({
          requestId,
          question,
          retrievedSourceRefs,
          refused: true,
          citationCount: 0,
          latencyMs: Date.now() - startedAt,
          usdCost: 0,
          tokensIn: 0,
          tokensOut: 0,
          provider: "none",
          model: "none",
        })
      );
      return NextResponse.json(refusalAnswer());
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(question, chunks);
    const completion = await groqProvider.complete(systemPrompt, userPrompt);

    if (!completion) {
      console.log(
        JSON.stringify({
          requestId,
          question,
          retrievedSourceRefs,
          refused: true,
          citationCount: 0,
          latencyMs: Date.now() - startedAt,
          usdCost: 0,
          tokensIn: 0,
          tokensOut: 0,
          provider: "groq",
          model: "llama-3.3-70b-versatile",
        })
      );
      return NextResponse.json(refusalAnswer());
    }

    // Single source of truth for citation validation + the refusal decision
    // — see lib/chatbot/answer.ts. evals/chatbot/run-eval.mjs calls this
    // exact same function against cassette-recorded (or live) Groq
    // responses, so the eval can never silently drift from what this route
    // actually does.
    const result = buildAnswer(completion.content, chunks);

    const latencyMs = Date.now() - startedAt;
    const logFields = {
      requestId,
      question,
      retrievedSourceRefs,
      citationCount: result.citations.length,
      latencyMs,
      usdCost: completion.usdCost,
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
      provider: completion.provider,
      model: completion.model,
    };

    console.log(JSON.stringify({ ...logFields, refused: result.refused }));
    return NextResponse.json(result);
  } catch (err) {
    const error = err as Error;
    console.error(
      JSON.stringify({
        requestId,
        question,
        latencyMs: Date.now() - startedAt,
        errorName: error?.name ?? "Error",
        errorMessage: error?.message ?? String(err),
        stack: error?.stack,
      })
    );
    // The embedding dependency being absent is not a fault — it is a known,
    // survivable degraded mode (@huggingface/transformers is optional because
    // its transitive native binary is fetched at install time). 503 rather
    // than 500 so the client can close the composer instead of inviting a
    // retry that cannot succeed.
    //
    // Matched by NAME, not instanceof: this route is TypeScript importing a
    // .mjs module, and bundling can leave two copies of the class identity in
    // play, which would make instanceof silently false and send a degraded
    // state out as a 500.
    if (error?.name === "EmbeddingUnavailableError") {
      return NextResponse.json(unavailableAnswer(), { status: 503 });
    }
    return NextResponse.json(serverErrorAnswer(), { status: 500 });
  }
}
