# Bundle budget re-ratification — 2026-08-12

## Why this report exists

`scripts/check-bundle-size.mjs`'s first real measurement (commit 6245891, PR #82)
came in at **192,560 bytes** gzip for `/` — 15,302 bytes *under* the
`reports/wave3-budget-reratification-2026-07-13.md` baseline of 207,862 bytes. Per
this repo's own rule (never adopt a lower number without adjudicating why it moved),
that gap was investigated before this gate merged, not silently accepted.

## Adjudication

**Method:** enumerated every chunk in both measurements and compared item-by-item —
wave3's own itemized table (`reports/wave3-tier2-microinteractions-2026-07-12.md`)
against `scripts/check-bundle-size.mjs`'s live output, both against the same route
(`/`), both 11 chunks.

| Role | wave3 (2026-07-13) | Today (2026-08-12) | Δ |
|---|---:|---:|---:|
| React + Next.js runtime | 70,982 | 71,606 | +624 |
| **core-js polyfill** (`0cz1d0mv5g_q7.js`) | **39,627** | **39,627** | **0 — byte-identical** |
| turbopack runtime | 4,150 | 4,282 | +132 |
| everything else (8 chunks: app code, shadcn/base-ui primitives) | 93,103 | 77,045 | **−16,058** |
| **Total** | **207,862** | **192,560** | **−15,302** |

**Polyfill check (rule: this is exactly the shape the 2026-07-12 bug took):**
`0cz1d0mv5g_q7.js` is present in the live total at 39,627 bytes — byte-for-byte
identical to the wave3 figure. Confirmed NOT a repeat of the 2026-07-12 incident;
`scripts/check-bundle-size.mjs`'s own `POLYFILL_MISSING` state did not fire and
would not have on this data.

**Cause:** `git log --since=2026-07-13 -- package.json` shows exactly two commits.
`f789b4d` touches only `@types/node` (dev-only, zero bundle impact). **`e1e9fb1`**
("chore(deps): bump the minor-and-patch group across 1 directory with 11 updates",
PR #64, merged 2026-08-11 — one day before this baseline) bumped:

| Package | From | To |
|---|---|---|
| `next` | 16.2.10 | 16.3.0 |
| `react` / `react-dom` | 19.2.4 | 19.2.8 |
| `shadcn` | 4.13.0 | 4.16.2 |

React runtime and the polyfill chunk stayed essentially flat (+624 / +0 bytes) —
consistent with those being framework-floor cost, not app code. The entire
−16,058-byte delta is concentrated in the "everything else" bucket (app code +
shadcn/base-ui-generated component output), consistent with the `shadcn` minor bump
regenerating component internals and/or Turbopack tree-shaking improvements in the
Next.js 16.3.0 point release. No code was deleted or features removed between
2026-07-13 and today that would explain a shrink this size — the wave-3 heat-toy
shell, command palette shell, count-up/monogram/cursor-glow/stagger, and every
feature shipped since are all still present and still contribute their own eager
bytes; the shrink is dependency-driven, not feature-removal-driven.

**Verdict: EXPLAINED.** Not under-counting. `scripts/check-bundle-size.mjs`'s
methodology (manifest-cross-checked live HTML parse) is trusted as of this report.

## New baseline: 192,560 bytes

`reports/wave3-budget-reratification-2026-07-13.md`'s 207,862-byte figure is
**retired** as of this report — it was correct for its own commit at its own point
in time, and stays untouched as historical record, but it is no longer the number
`scripts/check-bundle-size.mjs` measures against. `BASELINE_BYTES` in that script is
updated to 192,560 (informational — the ceiling is the actual gate, baseline is
reported for regression-delta visibility only, per the script's own header).

## Ceiling: unchanged at 220,160 bytes (215 KiB)

Not lowered. The ceiling was set with explicit headroom for future features
(`wave3-budget-reratification-2026-07-13.md`), and a lower baseline only means more
of that headroom is currently unspent (27,600 bytes now vs. 12,298 at ceiling-setting
time) — not a reason to tighten the cap. The escalation rule from that report still
applies unchanged: past 220,160 bytes, dynamic-import the new cost or cut it, don't
re-ratify the ceiling itself a third time.

## What's updated

- `scripts/check-bundle-size.mjs` — `BASELINE_BYTES` 207,862 → 192,560, comment
  points at this report.
