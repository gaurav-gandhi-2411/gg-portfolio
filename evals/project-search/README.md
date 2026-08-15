# Project search eval (BL-9) — what this eval can and can't prove

`run-recall-eval.mjs` scores four ranking approaches (MiniLM, potion-base-8M,
a self-built zero-dependency static-embedding matrix, keyword-only) against
28 hand-labeled queries in `fixtures/*.json`, each with an `expectedSlug`
naming which of the 13 projects in `content/products.ts` the query should
surface. Full results, Wilson 95% confidence intervals, and the decision
that followed from them are in
`reports/BL-9-round5-static-embedding-and-decision.md`. This file states two
real statistical weaknesses in that eval that report doesn't spell out on
its own — read the numbers there with both of these in mind, not as proof of
sophisticated retrieval.

## 1. n=28 over 13 candidates is a weak test

A purely random guesser — three guesses drawn from the 13 possible projects,
no signal at all — has an expected Recall@3 of `3 × (1/13) ≈ 23.08%`
(`node -e "console.log((3/13*100).toFixed(2))"`) and an expected Recall@1 of
`1/13 ≈ 7.69%`. Every tier's measured Recall@3 (89.3%–100.0% across the four
tiers, see the round-5 report's Task A1 table) clears that baseline by
60–77 percentage points. That gap is real and it says something: query text
carries genuine signal about which of these 13 projects it's describing, and
all four tested approaches pick that signal up.

It does **not** mean the near-100% scores are evidence of sophisticated
retrieval. Two things are true at once, and both need saying:

- Clearing a 23% random baseline by 60+ points at n=28 is a real, positive
  result — the mapping from query to project is learnable, and every tier
  learned it.
- A score in the high 80s/90s/100s on 28 queries has wide Wilson confidence
  intervals (see the round-5 report — e.g. keyword-only's Recall@1 95% CI is
  [68.5%, 94.3%], a 26-point-wide interval) and may partly reflect that this
  specific 13-project catalog has fairly distinct, easy-to-disambiguate
  projects (a wedding stylist, a gold-price tracker, and an issue-triage
  service don't overlap much in vocabulary) rather than any tier's retrieval
  sophistication. A catalog of 13 near-duplicate projects would very likely
  produce lower absolute numbers for every tier, including the ones that
  "won" here.

Read the absolute recall numbers with this context, not as proof by
themselves. The eval is not meaningless — the random-baseline comparison is
the evidence it isn't — but it is a weak instrument for ranking four already
close approaches against each other, which is exactly what round 5's Wilson
CIs and McNemar test found: none of the four are statistically
distinguishable at this sample size.

## 2. The 28 queries are LLM-generated, not human ground truth

Every query in `fixtures/*.json` was authored by a prior agent session
(BL-9, round 3) to *simulate* plausible recruiter/visitor phrasings — none
of them were sourced from real recruiters, real search logs, or any actual
usage of this search box (which has no analytics/logging on typed queries
by design). This is a real, disclosed limitation of the eval, not a detail
to soften behind neutral language: "a 28-query benchmark" without this
context would overstate what was actually measured. An LLM asked to write
plausible search queries for a known catalog of 13 projects will tend to
produce queries that use vocabulary close to how each project already
describes itself (`content/products.ts`'s taglines and tech chips) — which
is close to the best case for any of these four ranking approaches, keyword
matching especially, and is not necessarily representative of how a real
visitor unfamiliar with the exact project descriptions would phrase a
search.

## What would fix both

1. A larger, or expandable-over-time, query set — this file's own math shows
   the random baseline shrinks (and the achievable statistical power grows)
   as the catalog and query count both grow; either would tighten the CIs
   enough to actually separate close tiers.
2. Real query logs. This search box currently has none — no analytics beyond
   the site's existing `@vercel/analytics` pageview tracking, no typed-query
   capture (a deliberate scope decision: capturing free-text search input
   raises its own privacy/consent questions this feature was never scoped to
   solve). If usage data is ever collected under an explicit, disclosed
   policy, replacing or supplementing the LLM-generated fixtures with real
   phrasings would close this gap directly.

Neither is in scope for BL-9 round 5 — recorded here as the honest next step,
not attempted.

## Reproduce

```
node evals/project-search/run-recall-eval.mjs
node scripts/search/compute-recall-stats.mjs
```

Full methodology, per-query win/loss table, and the decision that followed:
`reports/BL-9-round5-static-embedding-and-decision.md`.
