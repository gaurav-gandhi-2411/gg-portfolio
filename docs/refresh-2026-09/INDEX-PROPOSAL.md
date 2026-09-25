# Proposal: stop `content/chatbot/index.json` conflicting on every content PR (proposal only, GG decides)

Source: read-only analysis of `origin/main`, 2026-09-25. Every claim cites file:line.

## Facts
- The index is built by `scripts/chatbot/build-index.mjs`.
  - Inputs are the case studies, `provenance.md`, `products.ts`, `experience.ts`, `availability.ts`, `site.ts` and `lib/case-study-anchors.ts` (`build-index.mjs:27,35-42,51-56,358-374`).
- It embeds with a local ONNX model, `Xenova/all-MiniLM-L6-v2` (q8). There is no paid API.
  - The model is unpinned and downloaded from the Hugging Face hub on a cold cache (`lib/chatbot/embed.mjs:8-14,61,71,100`).
  - Threads are pinned to 1 for determinism (`embed.mjs:62-67`).
- Output is not byte-stable:
  - `generatedAt` is a `new Date()` (`build-index.mjs:396`).
  - Floats are written at full precision in a single 5.3 MB line (`build-index.mjs:401`).
  - There are 613 chunks. 29 of the 146 main commits since 2026-08-25 touch this file.
- The freshness check (`scripts/chatbot/check-index-fresh.mjs`):
  - rebuilds the index and ignores `generatedAt`;
  - requires an exact match on chunks, fields and model;
  - requires cosine similarity ≥0.99 per embedding (`:33,51-67,86-93`);
  - runs in CI on PRs and on main pushes (`ci.yml:21-22,48,90-91`).
- Rebuild plus check takes 28–33 s on CI (runs 36059831549 and 36054489475). `next build` takes about 16 s.
- Consumers:
  - runtime retrieval (`lib/chatbot/retrieve.ts:9`, which bundles the file) and `app/api/chat/route.ts:25,165`;
  - the eval, which retrieves over the committed file (`evals/chatbot/run-eval.mjs:108-116,161-168,222-230`; `eval.yml:81-85`);
  - e2e and unit tests, and `check-no-em-dash.mjs:107`;
  - the metrics-refresh bot's rebuild (`metrics-refresh.yml:353-360`).
- There is no `vercel.json` and no `.gitattributes`. Deploys make no network calls today.

## Options
| | Effort | Vercel build | Determinism | Eval/freshness reads | Failure modes | Meets all 3 constraints* |
|---|---|---|---|---|---|---|
| A. prebuild at `next build`, not committed | 3–4 h | +~30 s (about 3× the build) | eval ≠ deploy run (only within tolerance) | freshly built file; the check is removed | a Hugging Face hub or CDN outage fails the deploy; model drift is silent | No |
| B. CI-built artifact, not committed | 5–8 h | +30 s, or an artifact download | same as A | the CI artifact | same as A, plus artifact expiry; local dev has no index | No |
| C1. `.gitattributes merge=ours` | 1–2 h | 0 | unchanged | committed file | **GitHub's merge button ignores merge drivers**; can silently keep a stale file | No |
| **C2. stable, mergeable format + embedding reuse** | 3–5 h | 0 | unchanged chunks become byte-stable across OS | committed file | cross-source numbering can merge as clean text but still be stale | **Yes** |
| D. bot rebuilds and pushes on PRs | 4–6 h | 0 | unchanged | committed file | needs a PAT or App; no forks; noisy history; still conflicts | Partly |

*The three constraints: deterministic eval, no silent staleness, no new deploy-time network dependency.

## Recommendation: C2
1. Drop `generatedAt` and `chunkCount` (`build-index.mjs:396,398`, `retrieve.ts:20-25`, `check-index-fresh.mjs:67`).
2. Write one chunk per line, with a leading comma, so git can three-way merge the file.
3. Reuse the committed embedding for any chunk whose id, text and model are unchanged. This makes unchanged lines byte-identical and cuts the rebuild to seconds.
4. The freshness check turns reuse off (`CHATBOT_INDEX_REEMBED=1`), keeping the same 0.99 tolerance.
5. Add `.gitattributes`: `content/chatbot/index.json linguist-generated=true -diff`.
6. Optional: on a main-push freshness failure, open an automatic regeneration PR (the `metrics-refresh.yml:353-374` pattern).

## Residual risks
- Cross-corpus numbering can go stale after a clean merge:
  - `#n` dedupe suffixes (`build-index.mjs:378-384`);
  - `p{n}`/`row{n}` counters (`:179-181,205,246`);
  - product URLs that depend on which slugs exist (`:285-290`).
  The main-push check or "require up-to-date branches" catches this.
- Neighbouring-chunk edits can still conflict. The next step would be per-source shards.
- The model revision is unpinned (`embed.mjs:100`); pin it.
- The pre-commit hook covers only case studies and `provenance.md` (`.pre-commit-config.yaml:39-43`). That is a separate one-line fix.
