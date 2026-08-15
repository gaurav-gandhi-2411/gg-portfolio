# BL-9 — semantic project search: measured model size and perf gates

All numbers on this page were measured, not estimated — commands and raw
artifacts are given so any of them can be reproduced or checked. This
supersedes the "~25MB, BELIEVED" figure from an earlier round; that was a
guess, this is a real `du`/curl-observed size.

**Round 4 superseded Gate (ii) below** — that measurement blocked the model
network entirely and so actually measured the KEYWORD tier's own cold
start, not the semantic model's. See
`reports/BL-9-round4-cold-start-and-model-comparison.md` for the honest,
cache-disabled, Slow-4G cold-start number (the model download turned out to
be ~2x the size reported here too, once `onnxruntime-web`'s WASM runtime is
counted) and the model2vec/potion-base-8M static-embedding comparison.

## Model

`Xenova/all-MiniLM-L6-v2`, `dtype: "q8"` (the quantized/int8 ONNX export),
loaded via `@huggingface/transformers` — same model family the `/ask`
chatbot already uses server-side (`lib/chatbot/embed.mjs`), loaded here
client-side instead (see `lib/search/embed-client.ts`'s header for why).

Real embedding dimension, read directly off the model's own output
(`content/search/project-embeddings.json`'s `dim` field, written by
`scripts/search/build-project-embeddings.mjs`): **384**. Matches the task
brief's assumption; verified, not assumed.

## Real on-disk size (Task 2)

Measured from the local ONNX runtime cache after running
`node scripts/search/build-project-embeddings.mjs` (which downloads the
exact same artifact set `@huggingface/transformers` fetches in-browser, per
`lib/chatbot/embed.mjs`'s `applyEmbeddingEnv`, which points `cacheDir` at
`os.tmpdir()/transformers-cache`):

```
$ du -sh /c/Users/gaura/AppData/Local/Temp/transformers-cache/Xenova/all-MiniLM-L6-v2
23M

$ ls -la /c/Users/gaura/AppData/Local/Temp/transformers-cache/Xenova/all-MiniLM-L6-v2/onnx/
-rw-r--r-- 1 gaura 197609 22972370 model_quantized.onnx

$ ls -la /c/Users/gaura/AppData/Local/Temp/transformers-cache/Xenova/all-MiniLM-L6-v2/
-rw-r--r-- 1 gaura 197609      650 config.json
-rw-r--r-- 1 gaura 197609   711661 tokenizer.json
-rw-r--r-- 1 gaura 197609      366 tokenizer_config.json
```

| File | Bytes | 
|---|---|
| `onnx/model_quantized.onnx` | 22,972,370 |
| `tokenizer.json` | 711,661 |
| `config.json` | 650 |
| `tokenizer_config.json` | 366 |
| **Total** | **23,685,047 bytes (≈ 22.6 MiB / 23.7 MB)** |

The weights file (`model_quantized.onnx`, 21.9 MiB) is ~97% of the total —
this is the real number a first-time visitor's browser downloads once they
focus the search box (confirmed by the browser-request capture below, which
shows the identical four file names fetched from `huggingface.co`).

## Network evidence the model never loads on page load (Task 3)

`e2e/project-search-network.spec.ts` captures every network request from a
fresh `/projects` load through focusing the search box, with NO route
interception (a real, unblocked page) — this is the one test file in the
feature that lets the real download happen, to produce real evidence rather
than a code-reading argument.

Run: `npx playwright test e2e/project-search-network.spec.ts --project=desktop`

Result: **0 model requests among 34 requests on page load**; the first
model request fires only after `input.focus()`. Full captured lists (from
a real run, `console.log`'d by the test):

Requests on page load (34 total, 0 matching `.onnx` or `huggingface.co`):
every request is a same-origin `/_next/static/...` chunk/font, a
`/_vercel/...` analytics script, or a Next RSC prefetch
(`?_rsc=...`) — see the test's own stdout for the exact list.

Model requests fired only after focus (captured via a longer manual run,
`node -e` against a live `npm run start` server, same predicate):

```
https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/config.json
https://huggingface.co/api/resolve-cache/models/Xenova/all-MiniLM-L6-v2/.../config.json?...
https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer_config.json
https://huggingface.co/api/resolve-cache/models/Xenova/all-MiniLM-L6-v2/.../tokenizer_config.json?...
https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json
https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer_config.json
https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx
https://huggingface.co/api/resolve-cache/models/Xenova/all-MiniLM-L6-v2/.../tokenizer.json?...
https://huggingface.co/api/resolve-cache/models/Xenova/all-MiniLM-L6-v2/.../tokenizer_config.json?...
```

The weights file (`onnx/model_quantized.onnx`) is in that list — the exact
23.7MB artifact measured above, fetched only after interaction.

## Gate (i) — homepage LCP / First Load JS unchanged within noise

Measured real-devtools-throttled Lighthouse (not Lantern-simulated — see
`fix/perf`'s `scripts/lighthouse.mjs` diff, `THROTTLING_METHOD_OVERRIDE=devtools`,
applied locally for this measurement only and reverted before commit; not
shipped in this PR's diff), n=3 each, before vs. after this feature's full
diff. "Before" = `origin/main`'s `ff5ff7c` built in an isolated worktree;
"after" = this branch, same machine, same session.

| Route | Metric | Before | After | Delta |
|---|---|---|---|---|
| `/` | LCP (mean, n=3) | 2201.88ms ± 32.00 | 2220.74ms ± 48.01 | +18.86ms (< 1 stddev — noise) |
| `/` | First Load JS (gzip, `check-bundle-size.mjs`) | 194,284 B | 194,311 B | +27 B |
| `/projects` | LCP (mean, n=3) | 1978.48ms ± 54.21 | 1919.64ms ± 25.36 | −58.84ms (noise; faster, not slower) |
| `/projects` | First Load JS (gzip) | 192,560 B | 194,513 B | +1,953 B |

Homepage is untouched by this feature (`ProjectSearch` is imported only by
`app/projects/page.tsx`) — the near-zero home delta is the expected
by-construction result, confirmed rather than assumed. `/projects` carries
the feature's own eager shell cost (~1.95KB gzip: the input, listbox
rendering, `keyword-score.ts`, `searchable-text.ts` — everything that must
be interactive immediately; the ~23.7MB model and the embeddings JSON are
NOT in this number, they're dynamically imported, see Task 3 above) — well
inside the repo's 220,160-byte ceiling (27,647 bytes of headroom
remaining).

Raw artifacts: `reports/lighthouse-before-bl9-{home,projects}-devtools-2026-08-14.summary.json`,
`reports/lighthouse-feat-project-search-{home,projects}-devtools-2026-08-14.summary.json`.

Reproduce: apply `fix/perf`'s `scripts/lighthouse.mjs` diff locally (do not
commit it), then:
```
npm run build && npm run start
THROTTLING_METHOD_OVERRIDE=devtools RUNS_OVERRIDE=3 node scripts/lighthouse.mjs / /projects
```

## Gate (ii) — cold-start latency to first ranked result (mobile-throttled)

Real stopwatch measurement (`Date.now()` around a real Playwright
interaction), NOT Lighthouse's own timing — a real CDP session applying
Lighthouse's own default mobile profile (Moto G Power: CPU 4x slowdown,
150ms RTT, 1.6Mbps down / 750Kbps up), model network blocked (measuring the
keyword tier's own cold start — tier 2 only ever reranks an
already-visible list later, it never gates the first paint of results).

n=5, `page.goto` → `input.focus()` → type the brief's own example query
("reduces on-call issue triage time") → wait for the results listbox to
become visible:

```
[626, 593, 531, 632, 646] ms
mean: 605.6ms
median: 626ms
```

Run against this branch's `npm run start` server on the same machine as
the Lighthouse numbers above.

## Gate (iii) — keyword tier works with the model network fully absent

`e2e/project-search.spec.ts`'s entire `"keyword tier (model network
blocked)"` suite (9 tests) routes-intercepts every `.onnx` and
`huggingface.co` request and aborts it, then drives real typing/keyboard/
mouse interactions and asserts correct ranking — including the exact
"reduces on-call issue triage time" → TriageIQ-first case. Separately, a
`javaScriptEnabled: false` context confirms the `<input role="combobox">`
itself exists, is labeled, and accepts text in server-rendered HTML with no
client JS at all (the progressive-enhancement half of this gate).

Run: `npx playwright test e2e/project-search.spec.ts --project=desktop`
— 9/9 passed.

## Gate (iv)/(v) — reduced motion, keyboard, axe

Covered by `e2e/project-search.spec.ts`'s keyboard-flow tests and
`e2e/a11y.spec.ts`'s two new scans (`/projects` closed — already covered by
the existing route sweep — and `/projects` with the results listbox open,
model blocked for determinism). See those files' own headers for the
reduced-motion reasoning (this feature reuses `app/globals.css`'s existing
`.message-in` entrance class and Tailwind's `motion-reduce:transition-none`
on the option hover-color transition — no new animation logic).
