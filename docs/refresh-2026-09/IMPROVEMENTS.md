# refresh-2026-09 — Improvements backlog

This backlog is ranked by expected effect ÷ effort.
- **Autonomous** items are implemented through a normal PR plus an independent verifier, with before/after measurements.
- **GG** items are written up with a recommendation only; nothing is implemented without GG's decision.
- Status is as of 2026-09-25.

## Shipped this wave (from the loop and from incidents found)

| # | Item | Evidence | Before → after | PR |
|---|---|---|---|---|
| S1 | /api/chat returned 503 for every visitor: `@huggingface/transformers` 4.3.0 loads `onnxruntime-node` through a runtime `createRequire` call, which the file tracer doesn't follow, so the package was missing from the deployed function. | Canary runs 35816826625 through 36095590198 all returned 503 `embeddings_unavailable`; first failure came 2 min after the deploy of c6f4d61. | Canary on main: 503 on 8+ consecutive runs → 200 (run 36097749705). A CI guard now fails the build if the trace loses any of the 27 required files. | #255 |
| S2 | Chat-canary alerting was dead: `if:` conditions without `failure()` meant the alert steps were silently skipped (since #196, 2026-08-23). | Issue steps showed `skipped` on every failing run; no issue was opened in 46 h. | Alert issue #253 opened on a live failure (run 36095590198) and auto-closed on recovery. A CI lint (`check-workflow-failure-conditions`) blocks the pattern. | #254 |
| S3 | The content-pipeline verifier model had been retired (404), and the stage failed silently (it returned null). | Model list from run 36076964611. | `qwen/qwen3.6-27b` → `qwen/qwen3.8-27b`. GREEN run 36077018824 produced 1 proposal. | #249 |
| S4 | The content pipeline failed soft on API, auth or network errors (R3). | `llm.mjs` returned null and exited 0. | Every non-2xx, auth, network or missing-key error now ends in a non-zero exit. RED run 36082904559 exited 1. There are 7 stubbed smoketest cases. | #251 |
| S5 | No 429 backoff, and the content-pipeline job had no timeout. | A live run waited 589 s on a single Retry-After. | Full-jitter backoff with 5 attempts; any Retry-After over 60 s fails loud instead of waiting; the job now has `timeout-minutes: 60`. | #252 |
| S6 | Horizontal overflow at 375 and 768 px. | Production: `/` at 391/375 and 784/768; mmfr at 377/375. | Split into three PRs: #246 (nav), #247 (hero and provenance), #248 (e2e gate). | #246–#248 |

## Autonomous backlog (ranked)

| Rank | Item | Evidence | Expected measurable effect | Effort |
|---|---|---|---|---|
| A1 | Branch-scope `metrics-refresh.yml` concurrency (`group: metrics-refresh-${{ github.ref }}`). | A dispatch on any branch cancels an in-flight run on any other branch without a message (observed on runs 36071653228 and 36077118014 during this wave). | Zero cross-branch cancellations. Checked by two concurrent dispatches on different refs, both completing. | 10 min |
| A2 | Fix `scripts/lib/resume-select.smoketest.mjs` and wire it into CI. | It fails on main (the forced-collapse set now includes `proj:eval-defect-bench`), and ci.yml doesn't run it, so the regression was never seen. | The smoketest passes and runs in CI. It must fail on a planted defect. | 30 min |
| A3 | Pin the embedding model revision in `lib/chatbot/embed.mjs:100`. | The Hugging Face model id is unpinned, so an upstream change would silently alter the index and retrieval. | Byte-stable index across time; the freshness check stays green on unchanged content. | 20 min |
| A4 | Widen the pre-commit chatbot-index hook to all index inputs. | `.pre-commit-config.yaml:39-43` covers only case studies and `provenance.md`. `products.ts`, `experience.ts`, `availability.ts`, `site.ts` and `case-study-anchors.ts` are missing. | Stale-index commits get caught locally instead of by CI (where the stale index has broken main twice). | 10 min |
| A5 | Merge-gate 2b vs CI concurrency: `cancel-in-progress` leaves `cancelled` runs on the head SHA when a PR gets both push and pull_request runs. | #223 was blocked until the cancelled runs were re-run by hand. | Either the gate ignores a cancelled run when a later success exists for the same check and SHA, or CI dedupes push and PR triggers. The fix lives in GG's `claude-config` tooling, so it may need GG's say. | 30–60 min |
| A6 | Hover-tooltip test in `e2e/hero-socials.spec.ts` flakes on emulated touch. | It flaked on #246, #247, #244 and #225 runs and passed on retry. | 0 flakes in 10 consecutive CI runs. | 1–2 h |
| A7 | Make `content/chatbot/index.json` mergeable: one chunk per line plus embedding reuse (the step-9 proposal, option C2). | 6+ extra merge-and-regenerate rounds this wave; 29 of 146 main commits touch the file. | 0 conflicts on PRs that touch different sources; rebuild time goes from about 30 s to a few seconds. | 3–5 h. Proposal only, per the brief; implement on GG's go. |

## GG-decision proposals

| # | Item | Evidence | Recommendation |
|---|---|---|---|
| G1 | The review-iq repo's own README still shows a per-language accuracy table and the retired 83.8% figure. | review-iq README metrics table. | Apply the display rule there too: overall number with CI only, and 83.8% marked as retired (llama v2.3). |
| G2 | The AetherArt repo homepage is the raw Cloud Run URL, which exposes the GCP project number. | `gh repo view` homepageUrl. | Point it at the warmup-bridge URL the site uses, or clear it. |
| G3 | multimodal-fashion-recommender, token-efficiency-scorer and agentic-shopping-assistant have no homepage set. | Repo-description audit. | Set them to the site's live or install links (HF Space, PyPI tracegauge, warmup bridge). |
| G4 | Commits carry the older commit email (the 2411 Gmail address), which is visible in public commit metadata; D4 says zero hits for that string. | Global CLAUDE.md names it the canonical commit email. | Decide whether D4 covers commit metadata. If yes, switch to a GitHub noreply address for future commits. Leave history unrewritten. |
| G5 | Direction A and B branches are behind main: no /research or /work/eval-defect-bench, and no OSS changes. | The overflow sweep covered only 23 routes on each. | Merge main into both before the direction decision, so GG compares them on current content. |
| G6 | Vercel runtime-log retention is about 1 h on the current plan, so diagnosing production incidents needed a canary body dump. | The runtime-log query returned nothing older than about 1 h. | Keep the canary body and headers printing (shipped in #254). Consider a free log drain only if incidents recur. |
| G7 | The two expense-tracker repo homepage edits. | The homepage was cleared because the URL is dead (404). | Confirm; the revert value is `https://expense-tracker-tawny-eight-98.vercel.app`. |

## Session 6 status (2026-10-05)

Decision by GG (repo owner), relayed by orchestrator: the résumé is produced by GG directly. No résumé file is edited, regenerated or merged by automation, and résumé-regeneration work is **removed from this backlog** (PR #225 closed; the required changes live in a private, gitignored checklist). The résumé *tooling* items (A2, A8 smoketest wiring) were test-only and are unaffected.

| Item | Status | PR |
|---|---|---|
| A1 concurrency per ref | shipped earlier (conc branch) | n/a |
| A2 resume-select smoketest in CI | shipped earlier | |
| A4 pre-commit hook covers every index input (+ drift test) | shipped | #275 |
| A6 hover-tooltip flake | shipped earlier (#262) | #262 |
| A8 resume-lint smoketest wired into CI | shipped (red proof run 37287493015, green 37287536601) | #277 |
| A9 measure-overflow exits non-zero | shipped | #278 |
| A10 error prefix names the right provider | shipped | #279 |
| Lighthouse sub-90 diagnostics | shipped after live proof (run 37284493137: slow page median 52 → diagnostics, control 93 → none; separate run 37284836762: error URL → exit 1) | #260 |
| mmfr 375px overflow (2nd source: closed provenance panel kept its box until hydration) | shipped; 152/200 → 0/200 failures | #276 |
| A3 pin embedding model revision | blocked on the index decision (#273 vs #274) | |
| A5 merge-gate vs cancelled runs | open; additionally `merge_gate.py` reported ELIGIBLE for #278/#279 while their pull_request-event `e2e` was red (it appears to read the green push-event duplicate). Lives in GG's claude-config; needs GG | |
| A7 mergeable chatbot index (C2) | two variants open, GG to choose | #273 (batch 1, vectors move) / #274 (keeps vectors, freshness floor unsafe on clean merges) |

New findings for GG (not implemented):
- G8: site content still says "English, Hindi and Hinglish" (content/products.ts, content/case-studies/reviewiq.ts) and names llama models for review-iq; review-iq's eval/README say gpt-oss and Hindi retired (ADR 0022).
- G9: the TriageIQ case study and provenance.md call the fabrication gate "informational"; the triage-iq README and ADR-0044 say it is a hard gate.
- G10: `content/resume-metrics.json` `resume_pdf_sha256` does not match the live PDF.

## Focus-ring audit and deferred a11y/UI items (2026-10-13)

Audit method: Playwright tabs through /, /projects, /work/triageiq, /open-source, /research and /ask (desktop 1440, light and dark, reduced motion) and, at every stop, reads the computed outline or box-shadow ring, its contrast against the adjacent background, clipping by overflow ancestors and the viewport, and the visual order. 446 stops after the fixes in this PR. Not covered: the mobile project, hover-only states, and focus on elements that appear only after interaction (open menus, the ask answer area).

Fixed in this PR: the 4 text inputs whose ring was `ring-ring/50` (2.25:1 light, 2.43:1 dark, now 5.3:1 or better), and the citation links inside closed provenance panels, which were tab stops with an invisible, clipped ring (now `tabindex=-1` while closed).

Needs a design decision (not fixed):

- Hero tab order: DOM order is status pill, then the socials row (y=658), then the headline stats (y=346), so focus jumps back up the page after Email. Fixing means reordering the hero DOM or the layout.
- `components/search-methodology.tsx` line 145: `InlineLink className="text-caption"` goes through tailwind-merge, which reads `text-caption` as a colour and drops InlineLink's `text-foreground`. Size is correct (11.52px), but the link renders muted (rgb 83,86,95 light) instead of foreground (rgb 20,21,26). Measured on /projects with the methodology disclosure open. Bracket form `[font-size:var(--text-caption)]` would restore the colour, which is a visible change, so it is left for a decision.
- The `.hero-status` link is flagged as clipped by `.hero-mask` (`overflow: clip`) by the audit, but the mask has `overflow-clip-margin: 12px` and the ring needs 4px, so this is an audit false positive and not a defect.

Deferred items reported by earlier sessions (not worked in this PR):

- D1: homepage inline link rows are under 24px tall ("Pull request ↗", "PyPI ↗").
- D2: the /projects search input is 42px tall.
- D3: literal font sizes outside the hero have not been audited.
- Filter pills do nothing on a tap before hydration. Progressive enhancement option: real `<a href="?category=...">` links.
- /work/adk-tracegauge overflows horizontally at 320px (scrollWidth 340 vs 320) because of a `min-w-[26rem]` table.
- The home Work-section pills move +28px about 2s after load (cause not identified).
- Clicking the nav scrim leaves focus on body.
- Checker call-site wiring is untested: the pushes of `unreadableForStudy`, `publicSources` and `selfReported` in `scripts/check-metric-freshness.mjs`.
- `scripts/check-metric-freshness.mjs` `CHANGELOG_TRANSITION_PATTERN` drops any number inside an `A -> B` span, so cited transition values such as `52,494` in "Catalogue size: 61,883 -> 52,494 items" and `0.813` after an arrow are never seen (3 false drift flags on 2026-10-05).
