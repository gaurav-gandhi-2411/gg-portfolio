// Pure helpers over a CaseStudy object, extracted from scripts/check-metric-freshness.mjs so they
// can be unit-tested without that script's network side effects.

/**
 * Shown next to every claim whose source lives only in a private repo and so cannot be checked by
 * anyone but its author (and not by this repo's CI, which carries no credential for it). The page
 * renders this same string; keep both pointed at this constant's wording.
 */
export const SELF_REPORTED_LABEL = "self-reported (private repo)";

/**
 * A claim flagged `selfReported` in content (CaseStudy results/decisions/story) is reported in its
 * own SELF_REPORTED section and excluded from drift/unchecked accounting: there is nothing the
 * checker could compare it against, and listing it as "UNCHECKED" every week reads as a gap to fix
 * rather than a stated, labelled property of the claim.
 *
 * @param {{selfReported?: boolean}} claim
 * @returns {{status: "SELF_REPORTED", detail: string} | null} null = run the normal checks
 */
export function classifySelfReported(claim) {
  if (claim.selfReported !== true) return null;
  return {
    status: "SELF_REPORTED",
    detail: `source repo is private; labelled "${SELF_REPORTED_LABEL}" on the page, excluded from drift/unchecked counts`,
  };
}

// Collects every sourced claim from a case study into { sourceRef, text, kind, selfReported }, where
// `text` is exactly what the site displays for it (value+detail for a result row, body for a
// decision, the joined paragraphs for the story) -- the text that actually ships, not a
// separately-maintained copy of it, so there's no risk of validating against stale metadata.
export function collectCaseStudyClaims(study) {
  const claims = [];
  for (const r of study.results ?? []) {
    claims.push({
      sourceRef: r.sourceRef,
      text: `${r.value} ${r.detail ?? ""}`.trim(),
      kind: "result",
      selfReported: r.selfReported === true,
    });
  }
  for (const d of study.decisions ?? []) {
    claims.push({ sourceRef: d.sourceRef, text: d.body, kind: "decision", selfReported: d.selfReported === true });
  }
  if (study.story) {
    // A body paragraph can override the story's default sourceRef with its
    // own (see content/types.ts's doc comment) -- a mid-story topic shift
    // that's really evidenced by a different, existing claim's citation.
    // Overridden paragraphs are excluded from the main "story" claim's
    // joined text (checking them against the story's default source would
    // be exactly the wrong-citation bug this mechanism exists to fix) and
    // instead become their own claim, each against its own sourceRef.
    const plainParagraphs = study.story.body.filter((p) => typeof p === "string");
    const overrideParagraphs = study.story.body.filter((p) => typeof p !== "string");
    claims.push({
      sourceRef: study.story.sourceRef,
      text: plainParagraphs.join(" "),
      kind: "story",
      selfReported: study.story.selfReported === true,
    });
    for (const seg of overrideParagraphs) {
      claims.push({ sourceRef: seg.sourceRef, text: seg.text, kind: "story-segment" });
    }
    // A story's optional leadIn restates a fact really evidenced by a
    // different claim's own source (see content/types.ts's doc comment) --
    // checked as its own claim against its own sourceRef, not folded into
    // the main story text above, which would check it against the wrong
    // citation.
    if (study.story.leadIn) {
      claims.push({ sourceRef: study.story.leadIn.sourceRef, text: study.story.leadIn.text, kind: "story-leadIn" });
    }
  }
  if (study.diagram) {
    const pointsText = study.diagram.points.map((p) => `${p.label} ${p.value}`).join(" ");
    claims.push({ sourceRef: study.diagram.sourceRef, text: `${pointsText} ${study.diagram.caption}`, kind: "diagram" });
  }
  return claims;
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
    // GENERATED* claims have their own report section (scripts/lib/generated-claims.mjs).
    numericTotal:
      results.length - n("NOT_NUMERIC") - n("SELF_REPORTED") - n("GENERATED") -
      n("GENERATED_OVERDUE") - n("GENERATED_UNREADABLE"),
  };
}

/**
 * Case-study-level "overdue for re-verification" verdict. Self-reported claims cannot be re-verified
 * by anyone from the public side, so they never make a study overdue: a study is overdue only if it
 * is older than `staleDays` AND has at least one checkable (not self-reported) sourced claim. When
 * self-reported claims exist the report line says so, so the exclusion is visible, not silent.
 *
 * @param {{daysOld: number, staleDays: number, claims: {selfReported?: boolean}[]}} p
 * @returns {{stale: boolean, selfReportedCount: number}}
 */
export function verificationVerdict({ daysOld, staleDays, claims }) {
  const selfReportedCount = claims.filter((c) => c.selfReported === true).length;
  const checkable = claims.length - selfReportedCount;
  return { stale: daysOld > staleDays && checkable > 0, selfReportedCount };
}
