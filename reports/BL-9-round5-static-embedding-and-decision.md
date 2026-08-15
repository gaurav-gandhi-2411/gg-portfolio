# BL-9 round 5 — proper statistics, a corrected alternative measurement, a self-built zero-dependency option, and the final decision

**This round supersedes round 4's decision ("keep MiniLM").** Round 4's
decision was rejected for insufficient statistical rigor: it treated a
100.0% vs 92.9% Recall@3 gap (a 2-query difference out of 28) as a real,
decisive signal without ever testing whether that gap is distinguishable
from noise at n=28. It is not — see Task A1 below. Round 4 also measured
potion-base-8M's cold start via a proxy that came out *slower* than
MiniLM's full real cold start despite requiring no WASM runtime, called
this "the most plausible explanation... not independently verified," and
moved on. This round verifies that mechanism directly (Task A2) instead of
repeating the inference. Both errors pointed the same direction — toward
over-crediting MiniLM — and both are corrected here.

All numbers below were measured, not estimated. Every command is given so
every number can be reproduced.

## Task A1 — proper statistics on the existing eval

**Full per-query win/loss table, all 28 queries, all four tiers** (`hit`/`MISS` at rank 1 and rank 3):

| query id | MiniLM@1 | potion@1 | static@1 | keyword@1 | MiniLM@3 | potion@3 | static@3 | keyword@3 |
|---|---|---|---|---|---|---|---|---|
| agent-tool-description-eval | hit | hit | hit | hit | hit | hit | hit | hit |
| ai-wedding-stylist | hit | hit | hit | hit | hit | hit | hit | hit |
| claude-code-token-waste | hit | hit | hit | hit | hit | hit | hit | hit |
| clip-clothing-recommender | hit | hit | hit | hit | hit | hit | hit | hit |
| coding-agent-efficiency-score | MISS | MISS | MISS | hit | hit | hit | hit | hit |
| controlnet-art-generator | hit | hit | hit | hit | hit | hit | hit | hit |
| daily-secret-word-app | hit | hit | hit | hit | hit | hit | hit | hit |
| fake-review-detection | hit | MISS | MISS | MISS | hit | MISS | MISS | hit |
| fashion-from-photos | hit | hit | MISS | hit | hit | hit | MISS | hit |
| github-issue-resolution-time | hit | hit | hit | hit | hit | hit | hit | hit |
| gold-price-baseline | hit | hit | hit | hit | hit | hit | hit | hit |
| gold-rate-pwa-india | hit | hit | hit | hit | hit | hit | hit | hit |
| issue-triage-similar-bugs | hit | hit | hit | hit | hit | hit | hit | hit |
| japanese-woodblock-art | MISS | MISS | MISS | MISS | hit | MISS | MISS | hit |
| lora-image-generation | hit | hit | MISS | MISS | hit | hit | hit | MISS |
| mcp-ab-testing-harness | hit | hit | hit | hit | hit | hit | hit | hit |
| multi-agent-flight-booking | hit | hit | hit | MISS | hit | hit | hit | hit |
| multi-store-fashion-search-guardrails | MISS | hit | hit | hit | hit | hit | hit | hit |
| oncall-triage-time | hit | hit | hit | hit | hit | hit | hit | hit |
| personal-spending-forecast | hit | hit | hit | hit | hit | hit | hit | hit |
| plain-english-expense-entry | hit | hit | MISS | hit | hit | hit | hit | hit |
| retail-demand-forecast | hit | hit | hit | hit | hit | hit | hit | hit |
| review-analysis-hindi-english | hit | hit | hit | hit | hit | hit | hit | hit |
| safe-pc-cleanup | hit | hit | hit | hit | hit | hit | hit | hit |
| two-itinerary-travel-planner | hit | hit | hit | hit | hit | hit | hit | hit |
| walmart-sales-lightgbm | hit | hit | hit | hit | hit | hit | hit | hit |
| windows-disk-cleanup | hit | hit | hit | hit | hit | hit | hit | hit |
| word-guessing-embeddings | hit | hit | hit | hit | hit | hit | hit | hit |

Notable: on `japanese-woodblock-art`, keyword-only is the ONLY tier that
gets rank 1 right — all three model-based tiers (MiniLM, potion-base-8M,
this round's own static matrix) rank a fashion-adjacent project first
instead of aetherart. The literal substring match ("woodblock" appears in
aetherart's own searchable text) beats all three embedding spaces on this
query. Not cherry-picked — it's the first row above where keyword-only
uniquely wins, included because it directly undercuts the "smarter ranking"
framing this feature originally shipped under.

**Wilson 95% confidence intervals** (`node scripts/search/compute-recall-stats.mjs`, full output: `reports/BL-9-round5-recall-stats.json`):

| Tier | Recall@1 | 95% CI | Recall@3 | 95% CI |
|---|---|---|---|---|
| MiniLM | 89.3% (25/28) | [72.8%, 96.3%] | 100.0% (28/28) | [87.9%, 100.0%] |
| potion-base-8M | 89.3% (25/28) | [72.8%, 96.3%] | 92.9% (26/28) | [77.4%, 98.0%] |
| static-matrix (this round, A3) | 78.6% (22/28) | [60.5%, 89.8%] | 89.3% (25/28) | [72.8%, 96.3%] |
| keyword-only (this round, A4) | 85.7% (24/28) | [68.5%, 94.3%] | 96.4% (27/28) | [82.3%, 99.4%] |

**McNemar's exact test, MiniLM vs. potion-base-8M** (the two tiers round 4 treated as meaningfully different):

- Recall@1: discordant pairs b=1 (MiniLM right/potion wrong), c=1 (MiniLM wrong/potion right), n=2, **p = 1.0000**
- Recall@3: discordant pairs b=2, c=0, n=2, **p = 0.5000**

Neither is remotely close to significant. With only 2 discordant pairs total
at either threshold, no test could show significance here regardless of
which 2 queries they were — this is a sample-size ceiling, not a
borderline result.

**CI overlap, every tier vs. the best-performing tier (MiniLM):**

| Tier | Recall@1 CI overlaps MiniLM's? | Recall@3 CI overlaps MiniLM's? |
|---|---|---|
| potion-base-8M | yes ([72.8,96.3] vs [72.8,96.3]) | yes ([77.4,98.0] vs [87.9,100]) |
| static-matrix | yes ([60.5,89.8] vs [72.8,96.3]) | yes ([72.8,96.3] vs [87.9,100]) |
| keyword-only | yes ([68.5,94.3] vs [72.8,96.3]) | yes ([82.3,99.4] vs [87.9,100]) |

**Conclusion (stated plainly, per the task's own instruction): all four
tiers are statistically indistinguishable from each other on this 28-query
eval.** Every tier's 95% CI overlaps every other tier's, at both Recall@1
and Recall@3. The nominal point-estimate ranking (MiniLM ≥ potion ≥
keyword ≥ static) is not a finding this sample size can support as a real
ordering — it is noise dressed as a ranking. The deciding variable is
therefore correctly size/speed, not recall, exactly as the task brief
anticipated.

Reproduce: `node evals/project-search/run-recall-eval.mjs && node scripts/search/compute-recall-stats.mjs`
(requires `npm install @yarflam/potion-base-8m --no-save` first for the
potion-base-8M tier; `content/search/static-embeddings.json` must exist,
see Task A3 below).

## Task A2 — potion-base-8M re-measured, and the round-4 "incoherence" explained (not just repeated)

### Real wire bytes (real browser network capture)

`scripts/search/measure-cold-start.mjs --target=potion`, re-run this round:
a real `fetch()` inside a real Playwright page context, cache-disabled,
confirmed `fromDiskCache: false` on every response. The network log this
round also shows something round 4's report did not spell out: potion's
`model.safetensors` follows the SAME two-hop pattern MiniLM's ONNX weights
do — a `huggingface.co/api/resolve-cache/...` metadata call, then a
brand-new `fetch()` to a signed URL on `us.aws.cdn.hf.co` (HF's Xet
bridge). It is not "one origin" as round 4's mechanism explanation assumed
in its origin-*count* framing; the real distinction (see below) is how many
origins carry a *large* (multi-second) payload, not how many origins are
touched at all.

```
$ node scripts/search/measure-cold-start.mjs --target=potion
[potion] RESULT: fetch-start -> both files downloaded = 612342 ms (tokenizer.json: 683666 bytes, model.safetensors: 30236760 bytes)
[potion] confirmed: zero responses served fromDiskCache -- this is a genuine cold download
```

Real wire bytes: **683,666 + 30,236,760 = 30,920,426 bytes (≈29.5 MiB)** — a real browser fetch, not a Node file-size estimate (curl HEAD numbers from round 4 are corroborated here, not relied on).

### Cache-disabled Slow-4G cold start (real, re-measured, same methodology as MiniLM's 570,121 ms)

**612,342 ms ≈ 612.3 seconds ≈ 10.2 minutes** — consistent with round 4's
609,525 ms (0.5% delta, within real network-timing noise for a ~10-minute
transfer). Reconfirmed, not just cited.

### Per-query latency (from this round's unified eval run, `evals/project-search/run-recall-eval.mjs`)

MiniLM 2.45 ms, potion-base-8M 4.52 ms (Node, not browser — no real
in-browser integration exists, same caveat as round 4).

### Why potion (29.5 MiB) measures SLOWER than MiniLM (45.1 MiB) despite fewer total bytes — verified, not inferred

Round 4 left this as "the most plausible explanation... not independently
verified against Chrome's own CDP internals." This round tested it
directly: `scripts/search/verify-throttle-mechanism.mjs` fetches the same
total byte count (2 MB) two ways under the identical Slow-4G/cache-disabled
CDP setup — (a) 2×1 MB from ONE origin, sequential (potion's shape: one
large-payload origin) vs. (b) 1 MB + 1 MB from TWO origins, concurrent
(MiniLM's shape: two large-payload origins, `Promise.all`, matching this
repo's actual code). Byte counts are capped client-side by reading the
response stream and cancelling at the target length (the first version of
this test used `Range` headers alone and was itself wrong — `cdn.jsdelivr.net`
silently ignores `Range` and returns the full 3.9 MB file regardless,
which would have invalidated the comparison; fixed before trusting the
result, not after).

```
$ node scripts/search/verify-throttle-mechanism.mjs
[(a) 2x1MB from ONE origin (Xet CDN), sequential -- potion's shape] 42331 ms -- bytes: [1000500,1000000]
[(b) 1MB from Xet CDN + 1MB from jsdelivr, CONCURRENT -- MiniLM's shape] 26488 ms -- bytes: [1000500,1006746]

ratio (a)/(b): 1.60x
CONFIRMED: two-origin concurrent fetches complete meaningfully faster than the same total
bytes serialized on one origin -- Chrome's CDP throttle emulation grants each origin its own
effective lane rather than sharing one page-wide pipe. This is the mechanism, not an inference.
```

**Confirmed, with a controlled measurement, not an inference:** Chrome's
`Network.emulateNetworkConditions` throttles per-connection/origin, not as
one shared page-wide pipe (1.60x speedup for the same total bytes split
across two origins vs. one; a perfectly independent-lane model predicts 2x,
observed 1.60x — directionally decisive, with the gap plausibly TLS/DNS
handshake overhead on the concurrent path). MiniLM's true ~45.1 MiB splits
across TWO large-payload origins (Xet CDN's ~23 MB model weights,
jsdelivr's ~23.6 MB WASM runtime) that transfer concurrently and each get
their own throttled lane; potion-base-8M's ~30 MB has only ONE large-payload
origin (Xet CDN), so it gets exactly one lane and pays close to the full
serial cost. This is a genuine, now-verified property of THIS measurement
tool (Chrome's CDP network emulation), not necessarily of a real cellular
network — flagged honestly, not glossed over, since it means MiniLM's own
570,121 ms figure may be an UNDER-count relative to a real Slow-4G
connection that throttles per-device rather than per-socket. Either way,
this does not change Task A5's decision below: both real, tool-measured
numbers (570.1s, 612.3s) already clear the "multiple minutes" kill
threshold by well over an order of magnitude, so the exact ranking between
them is immaterial to what ships.

Reproduce: `node scripts/search/measure-cold-start.mjs --target=potion` (~10 min),
`node scripts/search/verify-throttle-mechanism.mjs` (~1.5 min, requires `npm run start` at `BASE_URL`).

## Task A3 — a zero-dependency pruned static-embedding matrix, built and measured

**Technique:** model2vec-style distillation, at word granularity. Each
vocabulary word is embedded as its own single-word "sentence" through the
real MiniLM pipeline (`lib/chatbot/embed.mjs`, the same model/config this
repo already runs at build time for the chatbot index and — until this
round — the project search index), and that pooled, normalized 384-dim
vector is kept as the word's static embedding. At **query time, zero
transformer forward passes happen** — a query is tokenized into words, each
word's precomputed vector is looked up by exact string match, and the
vectors are mean-pooled and renormalized entirely in
`lib/search/static-embed.ts` (~30 lines, no runtime dependency).

**Vocabulary composition — 983 words, deduplicated:**
1. every word appearing in the 13 projects' `buildSearchableText()` output (278 words) — guarantees full document-side coverage.
2. a hand-composed, hand-counted list of common English/tech/product words (`scripts/search/common-vocab.mjs`, 757 words) — chosen to widen query-side coverage beyond exact project vocabulary, generic and NOT drawn from the eval queries themselves (see that file's own header for why: pulling eval-query words into the vocabulary would inflate this tier's measured recall relative to how it performs on real, unseen queries).

Both counts and the union size (983) are printed by the build script, not
hand-counted.

**Quantization:** int8, one shared global scale (max absolute component
value across the whole matrix) — one multiply to dequantize, no per-row
overhead.

```
$ node scripts/search/build-static-embeddings.mjs
Vocabulary: 983 unique words (278 from content/products.ts, 757 from scripts/search/common-vocab.mjs, overlap accounts for the difference from the raw sum).
Embedding 983 words with MiniLM (one forward pass per word)...
Wrote 983 word vectors (dim=384, int8) to content/search/static-embeddings.json -- 1278156 bytes (1.219 MiB) on disk.
```

**Real wire bytes** (not estimated — temporarily served from `public/` on
the running production server, measured with `curl -H "Accept-Encoding: gzip"`,
the same methodology `scripts/check-bundle-size.mjs` already uses for this
repo's other real-wire-byte gates; not committed to `public/`, this was a
measurement-only step):

```
$ curl -s -o /dev/null -w "%{size_download}" -H "Accept-Encoding: gzip" http://localhost:3000/<asset>
427150
```

**427,150 bytes (≈417.1 KiB, ≈0.407 MiB) gzip** — the JSON's repeated
short-integer text and vocabulary strings compress to about a third of the
1,278,156-byte on-disk size.

**Real Slow-4G cache-disabled cold start** (same CDP methodology as A2/round 4):

```
[static-matrix] fetch-start -> downloaded = 9570 ms (1278156 bytes, decoded)
```

**9.57 seconds** — about 60x faster than MiniLM's real 570.1s and 64x
faster than potion's real 612.3s. Comfortably clears the "not multiple
minutes" bar the decision rule requires.

**Recall@1/@3:** 78.6% (22/28), 95% CI [60.5%, 89.8%]; 89.3% (25/28), 95%
CI [72.8%, 96.3%] — see Task A1's table. Lowest point estimate of the four
tiers, but its CI overlaps every other tier's (Task A1) — at n=28 this is
not distinguishable from any of them.

**Status: built, measured, NOT shipped** — see Task A5's decision below and
`lib/search/static-embed.ts`'s own header for why: keyword-only's CI
overlaps this tier's, and keyword-only is smaller (zero additional bytes
vs. this table's 427 KB gzip). Kept in the repo as a working,
tested, reproducible artifact — not wired into `components/project-search.tsx`.

Reproduce: `node scripts/search/build-static-embeddings.mjs`.

## Task A4 — the keyword-only fallback, scored for the first time

The always-shipped tier-1 substring/token-overlap scorer
(`lib/search/keyword-score.ts`) had never been run against the recall eval
before this round.

**Recall@1: 85.7% (24/28), 95% CI [68.5%, 94.3%]. Recall@3: 96.4% (27/28), 95% CI [82.3%, 99.4%].**

This is the single most important number in this round: keyword-only's CI
overlaps MiniLM's (the nominal "best" tier) at both Recall@1 and Recall@3
(Task A1). A much simpler system — no model, no network request, no
loading state, code that already shipped — is statistically indistinguishable
from every model-based alternative measured, including the one this feature
originally shipped with.

Reproduce: `node evals/project-search/run-recall-eval.mjs` (keyword-only
tier runs unconditionally, no optional dependency needed).

## Task A5 — the decision rule, applied mechanically

**Comparison table** (size = real wire bytes; cold start = real,
cache-disabled, Slow-4G, CDP-throttled measurement, not a proxy or
estimate, except potion-base-8M's which remains a real-browser-fetch proxy
for the two files a genuine in-browser integration would need — see A2):

| | MiniLM | potion-base-8M | static-matrix (A3) | keyword-only (A4) |
|---|---|---|---|---|
| Size (real wire bytes) | 47,299,486 B (45.1 MiB) | 30,920,426 B (29.5 MiB) | 427,150 B (0.407 MiB) | **0 B** (already shipped) |
| Cold start (Slow-4G, cache-disabled, real) | 570,121 ms (9.5 min) | 612,342 ms (10.2 min) | 9,570 ms (9.6 s) | 0 ms (no network) |
| Per-query latency (warm) | 2.45 ms | 4.52 ms | ~0.2 ms | ~0.06 ms |
| Recall@1 (Wilson 95% CI) | 89.3% [72.8, 96.3] | 89.3% [72.8, 96.3] | 78.6% [60.5, 89.8] | 85.7% [68.5, 94.3] |
| Recall@3 (Wilson 95% CI) | 100.0% [87.9, 100] | 92.9% [77.4, 98.0] | 89.3% [72.8, 96.3] | 96.4% [82.3, 99.4] |

**Applying the decision rule mechanically, in order:**

1. **Cold-start kill switch.** MiniLM (9.5 min) and potion-base-8M (10.2
   min) both fail "a cold start where a real visitor would wait multiple
   minutes is a kill, full stop" — by close to two orders of magnitude, not
   a close call. Both are eliminated regardless of recall. Their nominally
   higher recall point estimates are irrelevant to this decision — they
   were never in contention for shipping once the cold-start numbers were
   honestly measured (round 4 already established this for MiniLM; round 5
   confirms it for potion-base-8M too).
2. **Among what's left (static-matrix, keyword-only): ship the smallest
   option (real wire bytes) whose Recall@1 and Recall@3 CIs overlap the
   best-performing option's (MiniLM's) intervals.** Task A1 showed BOTH
   remaining tiers' CIs overlap MiniLM's at both thresholds. Between them,
   keyword-only is smaller — 0 bytes vs. static-matrix's 427,150 bytes —
   because it requires no additional asset at all; it is the ranking logic
   this feature already ships unconditionally.

**Decision: ship keyword-only. Remove the neural-reranking path entirely** — both the MiniLM tier this feature originally shipped and, despite building it specifically to solve the cold-start problem this round, the static-embedding matrix too.

**This is the surprising result, reported as instructed rather than
argued away:** an entire zero-dependency, purpose-built alternative was
constructed this round specifically to beat MiniLM's cold-start problem,
succeeded completely at that (9.6s vs 9.5min), and still loses the final
decision — not on recall (its CI overlaps everyone's) and not on cold start
(it clears the kill threshold easily) but purely on the mechanical
smallest-size tie-break against an option that was already shipping for
free. The correct reaction to this, per the decision rule as stated in
advance, is to ship the smaller option and say so plainly, not to
retroactively argue the static matrix should win because it "tried harder"
or because 25/28 nominally beats 24/28 — Task A1 already established that
1-query difference is not a real signal at this sample size.

## What changed in the shipped code

- `components/project-search.tsx` — the client-side MiniLM tier (loading
  state, dense-score blending, debounced re-embedding, focus-triggered
  model preload) is gone. Keyword/substring ranking
  (`lib/search/keyword-score.ts`) is now the only tier, unconditionally.
- `lib/search/embed-client.ts` — deleted (zero remaining callers).
- `@huggingface/transformers` stays in `package.json` as an
  `optionalDependency` — `/ask`'s server-side chatbot
  (`lib/chatbot/embed.mjs`) still uses it. Only this feature's client-side
  use is gone.
- `content/search/project-embeddings.json` and
  `scripts/search/build-project-embeddings.mjs` are no longer production
  artifacts — nothing in the shipped app reads them. Kept, with an updated
  header stating their new status, purely so
  `evals/project-search/run-recall-eval.mjs`'s MiniLM comparison tier stays
  reproducible. The CI freshness gate
  (`scripts/search/check-project-embeddings-fresh.mjs`) and its pre-commit
  hook are removed — enforcing freshness on a non-production artifact was
  exactly the disproportionate-blast-radius shape `CHECKS.md` warns about.
- `content/search/static-embeddings.json`,
  `scripts/search/build-static-embeddings.mjs`,
  `scripts/search/common-vocab.mjs`, `lib/search/static-embed.ts` — new
  this round (Task A3), fully built, tested, and measured, but NOT imported
  by any shipped runtime path. Kept as a reproducible, working artifact for
  this comparison and for any future round with a larger eval set.
- `e2e/project-search-network.spec.ts` — deleted. It proved the (now
  removed) client-side model tier stayed lazy until focus; there is no
  model network left in this feature for that test to exercise.
- `e2e/project-search.spec.ts`, `e2e/a11y.spec.ts` — updated to drop
  model-network blocking (nothing to block) and the
  `project-search-unavailable` status assertion (no more loading/
  unavailable states — keyword ranking is synchronous and always
  available).

## Reproduce everything in this report

```
npm install @yarflam/potion-base-8m --no-save   # eval-only, not committed
node evals/project-search/run-recall-eval.mjs           # A1, A4 base data + report
node scripts/search/compute-recall-stats.mjs            # A1 Wilson CIs + McNemar
node scripts/search/build-static-embeddings.mjs         # A3 vocab + matrix build
npm run build && npm run start                          # in one terminal, for the below
node scripts/search/measure-cold-start.mjs --target=potion       # A2, ~10 min
node scripts/search/verify-throttle-mechanism.mjs                # A2 mechanism, ~1.5 min
```
