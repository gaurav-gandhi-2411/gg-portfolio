# Prose-drift checker

Read by `scripts/check-prose-drift.mjs`. This doc is the one place that explains why the tool
exists, why it's manual instead of scheduled, and the measured numbers behind that decision — the
script's own header comment has a shorter version of the same facts, kept in sync with this file.

## What this catches that the automated checks can't

`scripts/check-metric-freshness.mjs` (wired into `metrics-refresh.yml`'s `metric-freshness` job,
weekly) checks numeric claims against their cited source. It has no anchor for prose: architecture
descriptions, status claims, enumerations. Two real incidents happened for exactly this reason —
gold-rate-tracker's case study described an inverted Tanishq/IBJA data-source architecture, and
expense-tracker's case study had a half-wrong outage status — both shipped and sat live for weeks
before a manual read caught them, because nothing was checking whether the prose still matched its
source.

The prose-drift checker closes that gap: for each case study, it bundles the architecture/status/
enumeration prose (`problem`, `approach`, `architecture.*`, `closing`) and sends it, alongside the
source repo's current `README.md`, to three local Ollama judges (`gemma2:9b`, `llama3.1:8b`,
`qwen2.5:7b`) run blind on an identical prompt. A 2-of-3 majority vote that the prose contradicts
the README triggers a flag. Output is labeled `LLM-consensus`, matching this repo's existing
content-pipeline convention (`docs/content-pipeline-rubric.md`) — this is model judgment, not
verified fact. **It flags for human review. It never auto-edits content.**

## Why it's manual, not scheduled — the measured numbers

Calibration against the prescribed controls (the actual pre-fix text of both incidents above,
paired with their post-fix, corrected text — see `scripts/prose-drift-controls/`) scored **4/4
(100%)**: both real contradictions were correctly flagged, both corrected versions were correctly
left alone.

That result alone would justify wiring the checker into `metrics-refresh.yml` next to
`metric-freshness`. It wasn't, because a second run — against all 12 live, currently-correct case
studies, not just the calibration fixtures — flagged 3 more: `dealhunter`, `reclaim`, `triageiq`.
Hand-verifying all 3 against actual source found **all 3 to be false positives.** The judges'
"data-source/component primacy" contradiction class (one of three contradiction classes the prompt
asks each judge to check) over-fires on ordinary sequentially-described content that makes no
actual competing-primacy claim — the clearest example: dealhunter's README lists `PlannerAgent`
first in a normal request pipeline (`PlannerAgent → flight search → OptimizerAgent`), not a
primacy claim of any kind, and `llama3.1:8b` invented a contradiction from that ordering alone.

A useful tell, in hindsight: the two genuine positive controls both produced judge evidence that
quoted **both sides** of a real conflict (the case-study prose's claim *and* the README's
contradicting claim, side by side). All 3 real-world flags had evidence that only paraphrased one
side, or was empty. A human skimming a flag's evidence field can usually tell the difference in a
few seconds — but a *scheduled, automated* issue doesn't get that skim before it lands in an inbox,
and a checker that's wrong 3 times out of 3 non-calibration flags erodes trust in every future
flag it raises, calibrated ones included.

**The standing automated backstop is the `verifiedAt` staleness check.** Every case study carries a
`verifiedAt` field (`content/types.ts`); `checkVerifiedStaleness()` in
`scripts/check-metric-freshness.mjs` flags any case study whose field is more than 30 days old,
regardless of what category of claim went stale. That check already forces a periodic human
re-read of every case study — architecture prose included — and is scheduled, weekly, with no
false-positive risk (it's a date comparison, not an LLM judgment call). The prose-drift checker is
a sharper, LLM-assisted tool for a human to reach for *during* that re-read, or before a content
wave that touches architecture/status prose specifically — not a replacement for it, and not a
second automated gate running unsupervised alongside it.

## Running it

```bash
# Real case studies — flags any of the 12 (13 minus warmer, a private repo) for human review.
node scripts/check-prose-drift.mjs

# Calibration — re-run whenever the judge panel, prompt, or model set changes, to confirm the
# checker still catches both known-answer controls before trusting its output on real content.
node scripts/check-prose-drift.mjs --controls
```

Requires a local Ollama with `gemma2:9b`, `llama3.1:8b`, and `qwen2.5:7b` pulled
(`ollama pull <model>`), reachable at `localhost:11434` (override with `OLLAMA_URL`). No paid
provider, no `ANTHROPIC_API_KEY`. An unreachable Ollama instance or a judge whose output can't be
parsed reports that case study as `UNVERIFIABLE`, never a silent "clean" (rule 98a — fail closed).
