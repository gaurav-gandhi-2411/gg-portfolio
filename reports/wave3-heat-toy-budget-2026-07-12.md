# Wave 3 Tier 2.4 (hero semantic-heat toy) budget report — 2026-07-12

Reuses Warmer's actual mechanic (same base model, `all-MiniLM-L6-v2`) rather than a
simplified imitation — a visitor plays the real thing, scaled down.

## Vocab asset generation

`scripts/generate-heat-toy-vocab.py`: 410 curated English words, embedded with
`sentence-transformers/all-MiniLM-L6-v2` (384-dim), reduced to 72 dims via PCA
(72.3% variance retained), quantized to uint8 per-dimension. Verified the reduction
didn't destroy semantic structure before shipping — nearest neighbors after
PCA+quantization stayed sensible:

| Word | Nearest neighbors (cosine similarity) |
|---|---|
| dog | cat (0.60), rabbit (0.41), bird (0.41), tiger (0.41) |
| happy | excited (0.68), joy (0.65), grateful (0.61) |
| ocean | sea (0.87), beach (0.68), lake (0.50) |
| king | kingdom (0.76), queen (0.68), throne (0.67) |
| red | blue (0.85), yellow (0.84), green (0.81) |

Output: `public/heat-toy-vocab.json`, 115,688 bytes raw / **41,708 bytes gzip** —
well under the 80 KB asset budget (49% margin).

## JS bundle — code-split, verified isolated

| Piece | Where it loads | Gzip size |
|---|---|---|
| `HeroHeatToyShell` (button + `useState` + `next/dynamic` reference) | **Eager** — part of the initial bundle | 1,556 bytes |
| `HeatToy` (cosine-sim logic, form, feedback UI) | **On interaction only** — `next/dynamic`, not referenced in the initial HTML (confirmed: chunk hash absent from server-rendered `<script>` tags) | 1,652 bytes |
| `heat-toy-vocab.json` | **On interaction only** — fetched client-side after activation, not an eager asset | 41,708 bytes |

**Total eager cost: +1,556 bytes.** Confirmed via full chunk re-measurement:
204,762 → 206,318 bytes (delta = 1,556, matches the shell's own size exactly — the
heavy component and vocab data contribute zero bytes to visitors who never click).

## Verification

- Logic correctness verified with a Node.js simulation using the real generated
  `heat-toy-vocab.json` and the exact client-side algorithm (dequantize + cosine
  similarity + daily-index hash) — exact-match guess scores 1.000, unrelated words
  score near/below 0, out-of-vocab words handled gracefully. Today's (2026-07-12)
  deterministic daily word: "build."
- Visually confirmed in-browser: shell renders as a styled button; clicking it
  swaps to an accessible form (`<label>`-bound textbox, submit button, `aria-live`
  feedback region) — verified via accessibility tree snapshot, not just visual
  inspection.
- `npm run lint` / `typecheck` / `build` all pass.
