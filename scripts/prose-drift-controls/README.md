# Prose-drift calibration controls

Fixtures for `node scripts/check-prose-drift.mjs --controls`.

- `gold-pre.ts` / `expense-pre.ts` — real, known-wrong text this site shipped before
  wave 19's correction (git commit `24a258d`), trimmed to the `problem`/`approach`/
  `architecture`/`closing` fields the checker reads. **Positive controls** — should flag.
- Negative controls aren't duplicated here — the checker loads the current, corrected
  `content/case-studies/gold-rate-tracker.ts` / `expense-tracker.ts` directly.

Committed (not scratch) so calibration is re-runnable whenever the judge panel, prompt,
or model set changes — see `docs/prose-drift-checker.md` for the last measured numbers.
