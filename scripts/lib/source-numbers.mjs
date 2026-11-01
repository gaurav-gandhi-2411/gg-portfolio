// Number-extraction primitives shared by scripts/check-metric-freshness.mjs. Moved here
// unchanged on 2026-11-01 so they can be unit-tested (scripts/lib/source-numbers.test.mjs).
// Matches a comma-grouped number ("2,300") before falling back to a plain
// one — alternation order matters in JS regex (first alternative that
// matches wins, not the longest), so the comma-pattern must come first or
// "2,300" would match as bare "2" then "300" as two unrelated tokens.
export const NUMBER_PATTERN = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

export function parseNumber(raw) {
  return Number(raw.replace(/,/g, ""));
}

// A changelog/narrative transition span — "k8s R@5 18.0%→24.67%", "was 18.0%,
// now 24.67%", "from 18.0% to 24.67%" — states that a number was ONCE true, not
// that it still is. The old side's literal digits survive in the document
// forever as historical narrative, even after a results table or diagram
// elsewhere has moved on to the corrected figure. extractSourceNumbers (used by
// both the per-metric whole-file loop and checkCaseStudyClaims) has no notion
// of "this text describes change over time" and so treated an old number's
// mere presence ANYWHERE in the file as current evidence — a superseded value
// stayed reporting CURRENT through two more real corrections in triage-iq's own
// README before this was caught (content/provenance.md's Wave 22 entry).
//
// Same span-exclusion shape as findApproximateRanges/APPROXIMATE_SPAN_PATTERN
// above: find spans, exclude every number whose match index falls inside one,
// rather than trying to classify which side of the span is "old" vs "new".
// Deliberately conservative — the fix only needs the OLD number gone, and
// excluding the NEW one too from THIS particular sentence costs nothing as
// long as the current figure is also restated somewhere else untouched by
// "→"/"was"/"from...to" framing, which every live-shipped metric checked
// against this repo's real sources is: a headline number that only ever
// appears inside its own changelog sentence, nowhere else in the document,
// would report POSSIBLE_DRIFT under this fix even while correct — a real,
// stated trade (same shape as this file's other documented tolerances), not
// hidden.
export const CHANGELOG_TRANSITION_PATTERN = new RegExp(
  [
    // "18.0%→24.67%" / "18.0% -> 24.67%" — arrow-joined pair, optional %, comma-grouped
    String.raw`\d[\d,]*(?:\.\d+)?%?\s*(?:→|->)\s*\d[\d,]*(?:\.\d+)?%?`,
    // "was 18.0%, now 24.67%" / "was 18.0% (post-fix now 24.67%)"
    String.raw`\bwas\s+\d[\d,]*(?:\.\d+)?%?\b[^.]{0,60}?\bnow\s+\d[\d,]*(?:\.\d+)?%?\b`,
    // "from 18.0% to 24.67%"
    String.raw`\bfrom\s+\d[\d,]*(?:\.\d+)?%?\s+to\s+\d[\d,]*(?:\.\d+)?%?\b`,
  ].join("|"),
  "gi"
);

export function findChangelogTransitionRanges(text) {
  return [...text.matchAll(CHANGELOG_TRANSITION_PATTERN)].map((m) => [m.index, m.index + m[0].length]);
}

// Same extraction, applied to a source file's full text — not deduped or
// length-filtered, since a short number in the source is still valid
// evidence for a token that itself passed extractTokens' length filter.
// Numbers whose match falls inside a changelog transition span (see
// findChangelogTransitionRanges above) are excluded — they document that a
// value changed, not what it currently is, and so are not valid evidence
// that a claim's number is still current.
export function extractSourceNumbers(text) {
  const transitionRanges = findChangelogTransitionRanges(text);
  const matches = [...text.matchAll(NUMBER_PATTERN)];
  return matches
    .filter((m) => !transitionRanges.some(([start, end]) => m.index >= start && m.index < end))
    .map((m) => parseNumber(m[0]));
}
