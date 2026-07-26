# Content pipeline curator rubric

Read by `scripts/content-pipeline/curator.mjs` — the LLM prompt embeds this file verbatim so the
rubric lives in exactly one place (here), not duplicated into the script.

## What this pipeline does

Wave 15 replaces the mechanical fetch-and-diff behavior of the old metric refresh (still handled
by `scripts/refresh-metrics.mjs` for *known, already-wired* metric IDs — see that file's header)
with four stages that curate and frame *newly discovered* facts from each source repo, instead of
copying whatever a repo's `.portfolio/metrics.json` says without judgment:

1. **Extractor** (`extractor.mjs`, no LLM) — pulls candidate facts from each repo's
   `.portfolio/metrics.json` and `README.md`, each with `file:line@SHA` provenance. Deterministic;
   never invents a candidate that isn't in the fetched source text.
2. **Curator** (`curator.mjs`, LLM) — scores every candidate against the rubric below. Rejects
   noise. Only candidates that pass advance.
3. **Framer** (`framer.mjs`, LLM) — drafts the actual copy change (a dek line, a results row, a
   story beat) for passing candidates, in GG's voice, applying the wave-15 framing rule: lead
   with the capability demonstrated, not the problem — the honest number stays, framed as
   evidence of the skill, never removed or softened.
4. **Verifier** (`verifier.mjs`, LLM, **a different model family than the framer** — see
   `run.mjs`'s model selection) — independently re-reads the same source material and checks the
   framer's draft against it. Flags: any number without a source in the fetched text, any claim
   the extractor didn't actually source, tone drift (boastful *or* self-deprecating away from the
   site's established honest-and-direct voice). Only drafts the verifier does not flag reach the
   PR.

Every stage's output is machine-labeled `LLM-consensus` in the PR body — this is model judgment,
not a human-reviewed ground truth, and the PR body says so plainly. **The pipeline never commits
directly.** Its only output is a PR; GG merges or closes it.

## The rubric (curator stage)

Score each candidate fact against all four axes. A candidate needs a clear **yes** on axes 1–2 to
advance; axes 3–4 are modifiers (a fact can still advance with a caveat noted).

1. **Proves a skill.** Does this fact demonstrate something a hiring manager or client would
   value — a measured result, a debugging story, an architectural decision with a stated
   trade-off? A version-bump or a dependency update does not pass this axis on its own.
2. **Is verifiable.** Does the candidate's own source text (the README paragraph, the manifest
   entry) actually contain the claim, in a form a human could re-check by opening that file at
   that line? A summary or inference that isn't literally present in the source fails this axis.
3. **Is current.** Prefer facts dated (or `measured_at`) within the last ~90 days. Older facts can
   still pass if nothing fresher covers the same ground, but flag the age in the curator's
   reasoning so the framer can decide whether to note it.
4. **Isn't redundant.** Check the fact against the case study's current copy (fetched into the
   curator's context) and against `content/provenance.md`. A fact that's already reflected on the
   site does not need a change — reject it here rather than let the framer draft a no-op.

## Explicitly reject

- Marketing-speak with no measurable content ("significantly improved", "much better") — the
  rubric exists precisely so vibes don't reach the site the way they can slip into a hand-written
  PR.
- Anything the extractor could not point to a specific source line for.
- Duplicate framings of a fact already covered (see axis 4).

## Honesty about this being a rubric, not a person

This rubric is applied by an LLM call, scored independently per candidate — it is not GG manually
reading every repo. Multi-model consensus (curator's model + verifier's different-family model
agreeing) stands in for human judgment on borderline calls; disagreement between the two is
reported in the PR body, not silently resolved in either direction.
