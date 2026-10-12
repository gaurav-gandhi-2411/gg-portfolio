// Per-claim PUBLIC sources for case studies whose own repo is private (Warmer: mindmeld is private,
// CASE_STUDY_REPO.warmer is null). A claim whose number is also published in a public artifact is
// text-checked against that artifact instead of being listed as "UNCHECKED (private)". Claims whose
// ONLY source is the private repo carry `selfReported` in content and never reach this map.
// Key: "<case-study file>|<sourceRef>".

const PAYLOADS = "https://raw.githubusercontent.com/gaurav-gandhi-2411/mindmeld-payloads/HEAD/evals/warmer";
// Public Hugging Face model card + benchmark dataset card for the shipped fine-tune.
const CARD = "https://huggingface.co/gauravgandhi2411/hinglish-relatedness-sbert/raw/main/README.md";
const BENCH = "https://huggingface.co/datasets/gauravgandhi2411/hinglish-relatedness-benchmark/raw/main/README.md";

const final = { label: "mindmeld-payloads evals/warmer/baseline_report.md", url: `${PAYLOADS}/baseline_report.md` };
const preFix = { label: "mindmeld-payloads evals/warmer/baseline_report_pre-fix.md", url: `${PAYLOADS}/baseline_report_pre-fix.md` };
const separation = { label: "mindmeld-payloads evals/warmer/embedding_separation_report.md", url: `${PAYLOADS}/embedding_separation_report.md` };
const card = { label: "HF model card hinglish-relatedness-sbert README", url: CARD };
const bench = { label: "HF dataset card hinglish-relatedness-benchmark README", url: BENCH };

export const PUBLIC_CLAIM_SOURCES = {
  "warmer|warmer:hinglish-fix": [final, preFix, card],
  "warmer|warmer:hinglish-baseline": [preFix],
  "warmer|warmer:embedding-separation": [separation],
  "warmer|warmer:hinglish-public-benchmark": [card, bench],
  "warmer|warmer:lora-reframe": [card, preFix],
};

/**
 * Text-presence check of a claim's numeric `tokens` against its public `sources` (union: a token
 * counts if it appears in ANY source). Same verdict shape as the repo-path check in
 * check-metric-freshness.mjs. A fetch failure on every source is UNVERIFIABLE, never "no drift".
 *
 * @param {{tokens: {display: string}[], sources: {label: string, url: string}[], text: string,
 *   fetchText: (url: string) => Promise<string>, matches: (token: object, sourceText: string) => boolean}} p
 */
export async function checkAgainstPublicSources({ tokens, sources, text, fetchText, matches }) {
  const foundIn = new Set();
  const errors = [];
  for (const { label, url } of sources) {
    let body;
    try {
      body = await fetchText(url);
    } catch (err) {
      errors.push(`${label}: ${err.message}`);
      continue;
    }
    for (const t of tokens) if (matches(t, body)) foundIn.add(t.display);
  }
  const where = sources.map((s) => s.label).join("; ");
  if (errors.length === sources.length) {
    return { status: "UNVERIFIABLE", detail: `all ${sources.length} public source(s) failed to fetch: ${errors.join("; ")}` };
  }
  if (foundIn.size === tokens.length) {
    return { status: "CURRENT", detail: `${foundIn.size}/${tokens.length} token(s) confirmed in public source(s): ${where}` };
  }
  const missing = tokens.filter((t) => !foundIn.has(t.display)).map((t) => t.display).join(", ");
  return {
    status: foundIn.size === 0 ? "POSSIBLE_DRIFT" : "PARTIAL",
    detail: `missing [${missing}] in public source(s): ${where} (text: "${text.slice(0, 100)}")`,
  };
}

/**
 * Counts for the claim-coverage report. Self-reported claims are labelled on the page and have no
 * source to compare with, so they leave BOTH the numeric-checkable denominator and the
 * UNCHECKED-private count; NOT_NUMERIC is excluded as before.
 *
 * @param {{status: string}[]} results
 */
export function claimAccounting(results) {
  const n = (s) => results.filter((r) => r.status === s).length;
  return {
    selfReported: n("SELF_REPORTED"),
    skippedPrivate: n("SKIPPED_PRIVATE_REPO"),
    numericTotal: results.length - n("NOT_NUMERIC") - n("SELF_REPORTED"),
  };
}
