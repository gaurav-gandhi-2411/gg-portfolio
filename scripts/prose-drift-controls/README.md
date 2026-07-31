# Prose-drift calibration controls

Fixtures for `node scripts/check-prose-drift.mjs --controls`. Real text this site
actually shipped, not synthetic examples:

- `gold-pre.ts` / `expense-pre.ts` — the pre-fix case-study content from commit
  `24a258d`, containing the real, known-wrong prose (gold-rate-tracker's inverted
  Tanishq/IBJA data-source architecture; expense-tracker's wrong outage status).
  **Positive controls** — the checker should flag these.
- `gold-post.ts` / `expense-post.ts` — the current, corrected content for the same
  two case studies. **Negative controls** — the checker should NOT flag these.

Kept committed (not scratch) so the checker's calibration is re-runnable any time
the judge panel, prompt, or model set changes — see the checker's own file header
for the last measured precision/recall against these four fixtures, and the
`docs/` note on real-world false-positive rate beyond this control set.
