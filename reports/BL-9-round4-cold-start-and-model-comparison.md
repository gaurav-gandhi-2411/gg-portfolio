# BL-9 round 4 — honest cold-start + static-embedding alternative

All numbers below were measured, not estimated. Commands are given so every
number can be reproduced. This round exists because round 3's "605.6ms mean"
cold-start figure (`reports/BL-9-model-size.md`, Gate (ii)) blocked the model
network entirely and measured the KEYWORD tier's own cold start, not the
semantic model's — dishonest for a download this size.

## C1(i) — honest, cache-disabled, Slow-4G cold start

**Method:** `scripts/search/measure-cold-start.mjs --target=app`. Fresh
Playwright/Chromium browser context (empty HTTP cache by construction — a
new context is a fresh incognito-like profile), plus CDP
`Network.setCacheDisabled(true)` for defense in depth. Network throttled via
CDP `Network.emulateNetworkConditions` to the task brief's own "Slow 4G"
numbers: **400 Kbps down, 400 Kbps up, 400ms RTT** (decimal Kbps — 400,000
bits/sec — converted to 50,000 bytes/sec for the CDP `downloadThroughput`/
`uploadThroughput` fields). Loaded `/projects`, focused the real search
input, typed the brief's own example query ("reduces on-call issue triage
time"), and measured real wall-clock time (`Date.now()`) from focus to the
first SEMANTIC-ranked result actually landing — detected via a new
`data-search-dense-scores-for` attribute (see
`components/project-search.tsx`) that only takes the query's exact value
once the tier-2 model has loaded, embedded the query, and the ranked list
has been re-sorted with dense scores. This is not a proxy: it is the same
DOM interaction a real visitor performs.

**Result:**

```
$ node scripts/search/measure-cold-start.mjs --target=app
[app] RESULT: focus -> first semantic-ranked result = 570121 ms
[app] confirmed: zero model responses served fromDiskCache -- this is a genuine cold download
```

**570,121 ms ≈ 570.1 seconds ≈ 9.5 minutes.** This is the honest first-visit
number for a Slow-4G connection with an empty cache. It is not rounded down,
not averaged with a warm run, and not softened. n=1 — a single throttled run
takes ~9.5 minutes by construction; see "What this means" below for why a
single honest measurement is more informative here than a noisy n=5 average
would be.

All 5 captured model-related responses (`config.json`, `tokenizer_config.json`
×2, `tokenizer.json`, and the actual `model_quantized.onnx` weights fetched
from HuggingFace's Xet CDN) confirmed `fromDiskCache: false` — the cache
was genuinely disabled, this is a real cold download, not an artifact of a
warm HTTP cache.

### A discovery this measurement surfaced: the model's real download is ~2x the previously reported size

Round 3's "23,685,047 bytes (≈22.6 MiB)" figure covered only the ONNX model
weights + tokenizer files. It did **not** include `onnxruntime-web`'s own
WASM runtime — a separate, necessary download (`@huggingface/transformers`
cannot execute the ONNX graph without it) from a **third** CDN
(`cdn.jsdelivr.net`), invisible in round 3's measurement because that round
never captured an unfiltered network log.

```
$ curl -s -o /dev/null -w "%{size_download}" \
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/ort-wasm-simd-threaded.asyncify.wasm"
23567050
$ curl -s -o /dev/null -w "%{size_download}" \
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0-dev.20260416-b7804b056c/dist/ort-wasm-simd-threaded.asyncify.mjs"
47389
```

| Component | Bytes | Host |
|---|---|---|
| `model_quantized.onnx` (q8) | 22,972,370 | HF Xet CDN (`*.cdn.hf.co`) |
| `tokenizer.json` | 711,661 | huggingface.co |
| `config.json` + `tokenizer_config.json` | ~1,016 | huggingface.co |
| `ort-wasm-simd-threaded.asyncify.wasm` | 23,567,050 | cdn.jsdelivr.net |
| `ort-wasm-simd-threaded.asyncify.mjs` | 47,389 | cdn.jsdelivr.net |
| **True total** | **47,299,486 bytes (≈45.1 MiB)** | 3 distinct hosts |

This is a real, previously-uncounted finding, independent of any decision
about the static-embedding alternative below. A separate small fix
(`e2e/project-search-network.spec.ts`, `e2e/project-search.spec.ts`) widens
the model-request predicate that undercounted this — see those files' own
comments and this round's `fix(search):` commit for detail. It does not
change this feature's actual laziness guarantee (still verified lazy,
still zero requests before focus) — it changes how big the honest total is
once a visitor does interact.

### What this means

A first-time visitor on a genuinely throttled connection with an empty
cache waits **~9.5 minutes** for the semantic tier to finish loading before
it can improve their ranking. The keyword tier (round 3's Gate (ii),
605.6ms mean) is unaffected and remains what every visitor gets immediately,
including this one for the ~9.5 minutes the semantic tier is still loading —
this is exactly why the feature is architected as two tiers rather than one.
But the semantic tier's own promise ("smarter ranking") is not something a
Slow-4G visitor will realistically ever see land before they've moved on.

## C1(ii) — static-embedding alternative: `minishlab/potion-base-8M`

**Model chosen:** `minishlab/potion-base-8M` — the official model2vec
"potion-base-8M" HuggingFace repo the task brief names directly. It has no
`@huggingface/transformers`-compatible browser packaging (transformers.js
does not support the `model2vec`/`StaticModel` architecture). The closest
real, installable-with-zero-cost JS equivalent found on npm is
[`@yarflam/potion-base-8m`](https://npm.im/@yarflam/potion-base-8m) — a
third-party (not HuggingFace/minishlab-maintained), MIT-licensed,
zero-dependency Node port that loads the exact same published weights
(`model.safetensors`, verified byte-identical size to the official repo
below) and does mean-pooled, L2-normalized embedding in pure JS, no ONNX/WASM
runtime. Installed locally for this evaluation only:
`npm install @yarflam/potion-base-8m --no-save` — **not added to
`package.json`**; see "Decision" below for why.

This package is Node-only (uses `fs.readFile`, not `fetch()`) — there is no
real in-browser integration of it in this repo. Everywhere this report
measures "potion-base-8M in the browser," it is a proxy built from the
official model's own published artifact sizes and a real Playwright
network fetch of those exact bytes, not a working UI. This is stated
explicitly, not glossed over.

### 1. Model size on disk (real, measured)

```
$ curl -sIL https://huggingface.co/minishlab/potion-base-8M/resolve/main/model.safetensors | grep -i content-length
content-length: 30236760
$ curl -sIL https://huggingface.co/minishlab/potion-base-8M/resolve/main/tokenizer.json | grep -i content-length
Content-Length: 683666
$ curl -sIL https://huggingface.co/minishlab/potion-base-8M/resolve/main/config.json | grep -i content-length
Content-Length: 202
```

| File | Bytes |
|---|---|
| `model.safetensors` (fp32, unquantized — no quantized variant is published) | 30,236,760 |
| `tokenizer.json` | 683,666 |
| `config.json` | 202 |
| **Total** | **30,920,628 bytes (≈29.5 MiB)** |

This matches `@yarflam/potion-base-8m`'s own npm-packaged weights
byte-for-byte (confirmed via `npm pack` + local extraction) — same model,
same numbers.

**Important, counter-to-assumption finding:** potion-base-8M's own
published weights (30.9 MB, fp32, no quantized release exists) are **larger**
than MiniLM's already-quantized (q8) model+tokenizer alone (23.7 MB) — the
"dramatically smaller" premise does not hold for a raw model-file
comparison. It only becomes smaller once MiniLM's true total is counted
honestly (45.1 MiB, including the onnxruntime-web WASM runtime — see
C1(i)'s discovery above): 29.5 MiB vs 45.1 MiB, about 35% smaller by that
apples-to-apples measure.

### 2. Cache-disabled Slow-4G cold start (real, measured, same methodology as C1(i))

No real UI exists to click through, so this measures the network-bound
proxy: fetching `tokenizer.json` + `model.safetensors` directly (the two
files a real integration would need; `config.json`'s 202 bytes would
realistically be inlined into the JS bundle at build time, not fetched, so
it is excluded) from a real page context, same fresh-context +
cache-disabled + Slow-4G throttle as C1(i). Parsing the safetensors format
and running one embed pass afterward is sub-10ms pure-JS work (see
per-query latency below) — network transfer dominates completely, so this
proxy is a close, honest lower bound on what a real integration's cold
start would measure, not an apples-to-oranges comparison.

```
$ node scripts/search/measure-cold-start.mjs --target=potion
[potion] RESULT: fetch-start -> both files downloaded = 609525 ms (tokenizer.json: 683666 bytes, model.safetensors: 30236760 bytes)
[potion] confirmed: zero responses served fromDiskCache -- this is a genuine cold download
```

**609,525 ms ≈ 609.5 seconds ≈ 10.2 minutes.**

This is **slower** than MiniLM's real, full, end-to-end 570,121 ms
(C1(i)) — despite potion-base-8M's true total (29.5 MiB) being smaller than
MiniLM's true total (45.1 MiB). The most plausible explanation, based on
what was directly observed in the captured network logs (not independently
verified against Chrome's own CDP internals, stated as an inference): Chrome's
CDP network throttling appears to apply **per connection/origin**, not as
one shared page-wide pipe. MiniLM's ~45 MiB splits across three distinct
origins (`huggingface.co`, HF's Xet CDN, `cdn.jsdelivr.net`) that can
transfer with some overlap; potion-base-8M's 30 MB weights file is one
single transfer on one origin (HF's Xet CDN) with nothing to overlap
against, so its own throttled 30 MB takes close to its full serial time
(30,236,760 bytes ÷ 50,000 bytes/sec ≈ 604.7s — matches the 609.5s measured
almost exactly). Net effect: the byte-count advantage does not translate
into a cold-start-time advantage under this real measurement.

### 3. Per-query latency, warm (real, measured, Node — not browser)

`evals/project-search/run-recall-eval.mjs`, averaged over the full 28-query
eval set, model already loaded (first "warmup" call excluded):

| Model | Mean latency |
|---|---|
| MiniLM (`Xenova/all-MiniLM-L6-v2`, ONNX Runtime) | 2.81 ms |
| potion-base-8M (`@yarflam/potion-base-8m`, pure JS) | 4.72 ms |

Measured in Node, not the browser (no real browser integration exists —
see above) — stated as a proxy, not a browser number. Counter to the
"no transformer forward pass ⇒ faster" assumption, potion-base-8M is
slower per query in this measurement: its pure-JS `Float32Array.slice()`
token-embedding lookup + JS mean-pool loop is not vectorized the way
ONNX Runtime's compiled graph execution is, for a query this short (a
handful of tokens). Both are fast enough in absolute terms (sub-5ms) to be
imperceptible either way once the model is loaded.

### 4. Recall@1 / Recall@3 (real, measured, identical eval set)

28 hand-labeled queries, `evals/project-search/fixtures/*.json`, one
correct project slug (out of 13) per query, one explicitly marked ambiguous
between two projects. Both models embed the SAME `buildSearchableText()`
project text (production's own text-building function) and the SAME 28
queries. Full results: `reports/BL-9-round4-recall-eval.json`.

| Model | Recall@1 | Recall@3 |
|---|---|---|
| MiniLM | 89.3% (25/28) | 100.0% (28/28) |
| potion-base-8M | 89.3% (25/28) | 92.9% (26/28) |

Recall@1 is numerically tied, but the underlying error sets differ — this
is not the same 25 queries succeeding for both models:

- Both models miss `coding-agent-efficiency-score` ("scores how efficient a
  coding agent's session was" → tracegauge; both rank agentgauge #1) and
  `japanese-woodblock-art` ("generates Japanese woodblock print style
  artwork" → aetherart; both rank a fashion-adjacent project #1) at rank 1.
- MiniLM additionally misses `multi-store-fashion-search-guardrails` at
  rank 1 (ranks multimodal-fashion-recommender over style-maitri) but gets
  `fake-review-detection` right.
- potion-base-8M additionally misses `fake-review-detection` at rank 1
  ("detects fake or low quality product reviews" → reviewiq; ranks
  agentgauge #1) but gets `multi-store-fashion-search-guardrails` right.

At recall@3, potion-base-8M has two genuine misses MiniLM does not:
`japanese-woodblock-art` (aetherart drops out of potion's top 3 entirely —
`[multimodal-fashion-recommender, style-maitri, tracegauge]` vs MiniLM's
`[style-maitri, multimodal-fashion-recommender, aetherart]`, which at least
surfaces the right project third) and `fake-review-detection` (reviewiq
absent from potion's top 3 — `[agentgauge, gold-rate-tracker, tracegauge]`
— entirely unrelated to the query's topic, whereas MiniLM ranks reviewiq
first). These read as genuine semantic-quality gaps on specific query
shapes (jargon-adjacent terms like "efficient session," "fake reviews"),
not random noise — model2vec's own published benchmarks show static
embeddings trading retrieval quality for size/speed relative to
sentence-transformer models, consistent with what's measured here.

**My threshold for "within noise":** recall@1 tied is a clean parity
signal on its own. Recall@3 differing by 2/28 (~7 points) sits right at
the edge of the task brief's own example noise band ("within 1-2 correct
answers out of 20-30"), but I do not treat it as noise here, because (a)
the two recall@3 misses are systematic — the same query types where
potion-base-8M is weaker at rank 1 too, not scattered — and (b) this
component (`components/project-search.tsx`) reranks all 13 projects and
never hides results, softening but not eliminating the cost of a recall@3
miss (the correct project is still visible, just further down a list a
recruiter has to scroll past instead of seeing near the top).

## Decision: keep MiniLM this round

All four measured dimensions point the same direction:

1. **Recall@3** — potion-base-8M is measurably worse (92.9% vs 100%), and
   the misses look like real semantic-quality gaps, not noise (see above).
2. **Warm per-query latency** — potion-base-8M is slower in the one
   environment measured (Node), contrary to the "no forward pass ⇒ faster"
   assumption.
3. **True cold start** — potion-base-8M's real, measured proxy (609.5s) is
   slower than MiniLM's real, measured, full end-to-end number (570.1s),
   despite potion-base-8M's smaller true total bytes — the byte-count
   advantage did not survive contact with a real throttled measurement.
4. **Engineering/supply-chain risk** — shipping potion-base-8M in-browser
   requires either adopting an unofficial, single-maintainer,
   unaudited npm package with zero prior browser-production track record
   (it is Node-only as published; would need porting to `fetch()`-based
   I/O) or hand-rolling a safetensors parser + a BGE-compatible WordPiece
   tokenizer from scratch — both substantial new, unreviewed production
   surface disproportionate to this round's fix-focused scope.

None of this is a verdict on static embeddings in general — it's specific
to this exact model artifact (fp32, no quantized release), this exact
package, and this measurement setup. A future round could reasonably
revisit a smaller potion variant (`potion-base-2M` is 1,889,792 params ≈
7.2 MiB fp32 — genuinely smaller than MiniLM even before counting the WASM
runtime) or a properly quantized/native browser implementation, with the
engineering investment that deserves — but that is out of scope here.

**What ships this round:** the honest cold-start numbers above (C1(i)),
this comparison (C1(ii)), and the discovery that MiniLM's true download is
~2x what was previously reported. MiniLM stays the shipped model; no
production code path changes as a result of this comparison.

## Reproduce

```
npm run build && npm run start   # in one terminal
node scripts/search/measure-cold-start.mjs --target=app      # C1(i), ~9.5 min
node scripts/search/measure-cold-start.mjs --target=potion   # C1(ii)#2, ~10.2 min
npm install @yarflam/potion-base-8m --no-save
node evals/project-search/run-recall-eval.mjs                # C1(ii)#3/#4
```
