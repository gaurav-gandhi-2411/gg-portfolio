// scripts/content-pipeline/verifier.mjs — Wave 15, stage 4: independently re-checks the
// framer's draft against the same source text, using a different model family (see llm.mjs's
// MODELS map — Qwen via OpenRouter, not the Llama family curator/framer use) so the check isn't
// a second vote from a model with the same blind spots. Only drafts the verifier does not flag
// reach the PR.

const SYSTEM_PROMPT = `You are the verifier stage of an automated content-curation pipeline. You
are deliberately a DIFFERENT model family than the stage that drafted this text, so you can catch
what a same-family re-check would miss. Your job is to REFUTE, not rubber-stamp: default to
flagging if you are uncertain.

Check the draft against the source text for:
1. Any number or specific claim in the draft NOT literally present in the source text.
2. Tone drift — boastful ("revolutionary", "cutting-edge") OR falsely self-deprecating language
   that isn't in the source's own framing.
3. Whether the draft's claim is actually supported by the source, not just plausible-sounding.

Respond with JSON only: {"approved": boolean, "flags": ["list of specific issues, empty if none"],
"reasoning": "one sentence"}.`;

export async function verify(callLlm, sourceText, draft) {
  const userPrompt = `Source text (the only evidence allowed to support the draft):
"${sourceText}"

Proposed draft to verify:
"${draft}"

Verify the draft against the source.`;

  const result = await callLlm("verifier", SYSTEM_PROMPT, userPrompt);
  return result; // null (fail-soft) is treated as NOT approved by the caller — see run.mjs.
}
