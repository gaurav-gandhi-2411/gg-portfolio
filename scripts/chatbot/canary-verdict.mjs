// The chat-canary's own pass/fail logic, as a pure function over a response
// body string, so it can be exercised by a smoketest instead of only ever
// running for real against production every six hours.
//
// WHY THIS EXISTS: chat-canary.yml's own verdict logic used to live inline
// in a bash-wrapped `node -e '...'` block. That block broke twice, in the
// same way both times -- a monitor that can only ever report one thing.
//
//   1. PR #149 added a `refusalReason` runbook whose provider_unavailable
//      string contained "Groq's", an apostrophe inside the bash single
//      quote wrapping the whole script. Bash cannot escape a single quote
//      inside a single-quoted string, so the quote terminated early and
//      the remaining prose became literal shell tokens -- syntax error on
//      every run since, whether or not /api/chat was actually healthy.
//   2. That break was found only because a human went looking, not because
//      anything caught it -- the exact failure mode this file exists to
//      close. A canary nobody has seen fail is not a canary; this module
//      is exercised directly by canary-verdict.smoketest.mjs against a
//      known-good response and a known-bad response for every
//      `refusalReason` value, so a future edit that breaks the verdict
//      logic (a syntax error, a wrong runbook key, a flipped condition)
//      fails locally and in CI before it ever reaches the scheduled job.
//
// Inline shell script bodies cannot be unit tested at all -- pulling this
// out into a real module is the actual fix, not a cosmetic one. The CLI
// wrapper (check-canary-verdict.mjs) that chat-canary.yml now calls is a
// thin shell around this function.

export const RUNBOOK = {
  provider_unavailable:
    "The completion call did not come back. Check that the pinned model in lib/chatbot/llm-provider.ts is still on Groq's production list (it has been retired out from under us before), then check GROQ_API_KEY and quota.",
  no_grounding:
    "Retrieval scored below threshold for a question that used to pass. Check content/chatbot/index.json is current and that the embedding model loaded.",
  unvalidated_citations:
    "The model answered and cited nothing that validates. A prompt or corpus problem, not an outage.",
  embeddings_unavailable:
    "@huggingface/transformers did not load, so nothing can be embedded. Check the install-time optional dependency.",
  server_error: "The pipeline threw. Read the logged stack against requestId.",
  unreported:
    "The response carried no refusalReason, which means it came from a build older than the one that added it.",
};

/**
 * @param {string} rawBody - the /api/chat response body, as text
 * @returns {{ ok: boolean, exitCode: 0 | 1, stdout: string[], stderr: string[] }}
 */
export function computeVerdict(rawBody) {
  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false, exitCode: 1, stdout: [], stderr: ["response body did not parse as JSON"] };
  }

  const grounded =
    parsed.refused === false && Array.isArray(parsed.citations) && parsed.citations.length > 0;

  if (!grounded) {
    const reason = parsed.refusalReason || "unreported";
    const runbook = RUNBOOK[reason];
    return {
      ok: false,
      exitCode: 1,
      stdout: [],
      stderr: [
        `refusalReason=${reason}`,
        // A reason string that doesn't match any known key (a future
        // refusalReason added to lib/chatbot/answer.ts without a matching
        // entry here) must still say so explicitly rather than print
        // "undefined" -- the same fail-closed discipline as everything
        // else this repo's checks apply to an unrecognised value.
        runbook ?? `no runbook entry for refusalReason "${reason}" -- add one to RUNBOOK`,
        `full response: ${JSON.stringify(parsed)}`,
      ],
    };
  }

  return {
    ok: true,
    exitCode: 0,
    stdout: [`canary OK: ${String(parsed.answer).slice(0, 120)}`],
    stderr: [],
  };
}
