# spec.md — Portfolio + GitHub Profile Refresh (Wave: "refresh-2026-09")

Repos:
- Site: `C:\Users\gaura\ml-projects\gg-portfolio` → https://gaurav-gandhi.vercel.app (Next.js on Vercel)
- Profile README: `gaurav-gandhi-2411/gaurav-gandhi-2411` → https://github.com/gaurav-gandhi-2411
- OSS contributions working repo: `C:\Users\gaura\ml-projects\oss-contrib`

Owner: GG. Orchestrator: Opus 4.7 (Claude Code). Subagents: executor + verifier at `C:\Users\gaura\.claude\agents\`.

## 1. Goal

One consistent, current, recruiter-first identity across both surfaces, for Lead / Senior Applied AI roles at product companies. A reader should get role, Uber production impact, top products, OSS credibility and contact within one screen, with every number traceable to a source (existing provenance system stays the contract).

## 2. Baseline findings (fetched 2026-09-23, public pages, logged-out)

Verified from live pages — each must be resolved or explicitly justified:

| # | Surface | Finding |
|---|---|---|
| F1 | GH bio | Says "Senior Data Scientist"; README + site say "Lead Data Scientist" (Lead since Aug 2026). |
| F2 | GH README | adk-tracegauge "8 releases, v0.4.1"; site says "v0.9.1 · 17 releases". README is stale. |
| F3 | Both | Gold Rate Tracker backtest: README "204-fold", site card "199-fold". |
| F4 | Both | Gold repo description "no fake predictions" vs site card "predicts tomorrow's". Wording conflict. |
| F5 | Both | Paper status: README "Under submission", site "Preprint, pending arXiv". Needs GG ruling. |
| F6 | GH README | Journey row "2025–now … Independent" contradicts the Uber Lead role. |
| F7 | GH README | tracegauge (PyPI) missing entirely. Site links tracegauge source to repo `token-efficiency-scorer` — check vs issue #200 rename. |
| F8 | Both | No section for landed upstream open-source contributions. |
| F9 | GH profile | No pinned repos; "Popular" defaults to gold-rate-tracker first. |
| F10 | GH README | Research table is 2nd section, above shipped work. GG wants it demoted. |
| F11 | GH README | Duplicate content: "What I work with" and "Stack" tables overlap ~80%. "Corrections" table (nav-band bug etc.) is low recruiter signal at top-level. |
| F12 | Site | Not listed: Hinglish SBERT model + benchmark (HF), eval-defect-bench. Likely what issue #122 reports. |
| F13 | Site | "14 projects · 12 live" — grid shows fewer cards with a Live link. Verify definition or fix count. |
| F14 | Both | PyPI "downloads last week" shown raw; pypistats totals include mirrors/CI. Label or use without-mirrors figure. |
| F15 | gg-portfolio | 3 open bot issues (#122, #123, #200) and 9 open PRs (#99, #124, #125, #132, #135, #137, #152, #206, #208), several 5+ weeks stale. Root cause: weekly automations open work nobody drains. |

## 3. Scope

### Phase A — Audit (read-only)
- Local repo state: branch, uncommitted work, last deploy SHA vs `main`, CI status.
- Every open PR: CI status, mergeability/conflicts, diff summary, superseded-by, recommendation.
- Every open issue: exact contents, which items are real.
- Upstream OSS: `gh search prs --author gaurav-gandhi-2411 --merged` excluding own repos; plus open ones. Table: repo, PR #, title, merged date, stars of upstream repo, one-line impact.
- Cross-surface consistency table: every number/claim present on both site and README, with value per surface and source-of-truth value.
- Current PyPI versions/release counts for tracegauge, adk-tracegauge, agentgauge-harness (from PyPI JSON API).
- Baseline Lighthouse (mobile + desktop) and Playwright screenshots at 375/768/1440, light/dark, for `/`, `/projects`, one `/work/*` page.

### Phase B — Hygiene (no-regret)
- PR triage per rules in §5. Close superseded bot PRs with a comment linking the replacement.
- Fix automation root cause: weekly bot jobs update one rolling PR/issue per job (fixed branch, update-in-place) and auto-close when the check passes; Dependabot patch/minor auto-merge only when all gates green.
- Resolve issues #122/#123/#200 with content fixes, or close with evidence.

### Phase C — Content
- New "Open source" section on site (home + dedicated page) and README: merged upstream contributions only, each linked; own packages with live PyPI version. Open PRs may appear only in a clearly labelled "in review" line, never counted as landed.
- Fix F1–F7, F12–F14.
- Research demoted: README — below Shipped and Open source; site — per GG decision D2.
- README restructure (order): header/banner → one-line identity → production impact strip (Uber: ~70% automation, $10M+/yr, 50M+ docs — same provenance as site) → Shipped & live → Open source → How I work (keep falsification table, trimmed) → Research → Journey → Stack (merged single table) → footer. Corrections: move to a linked page, keep one example max.

### Phase D — UI modernization
- Site: propose 2 visual directions as screenshots (hero + project grid, mobile + desktop) before implementing; GG picks. Keep existing monogram identity unless GG asks otherwise. Above the fold must contain: name, role, Uber, 2 impact numbers, primary CTA (resume), contact.
- README: GitHub markdown has no CSS/JS, so modern look = generated SVG cards (light/dark via `<picture>` + `prefers-color-scheme`), each wrapped in a link, generated by the existing scheduled Action from the same data source as the site. No third-party image hosts (existing policy).

## 4. Acceptance criteria (verifier checks, all must pass)

1. Zero cross-surface conflicts in the consistency table (bio, title, versions, fold counts, paper status, dates).
2. Every number on both surfaces maps to a provenance entry; `verified` date ≤ 7 days old for any number changed this wave.
3. OSS section: every listed "merged" PR confirmed merged via `gh pr view --json mergedAt` on the upstream repo.
4. Open PRs in gg-portfolio: 0 older than 7 days without a written reason. Open bot issues: 0 stale.
5. CI gates green on `main`; production deploy SHA == `main` HEAD.
6. Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 95; CLS ≤ 0.05; no regression > 3 points vs Phase A baseline on any page audited.
7. axe-core: 0 serious/critical violations on audited pages.
8. Before/after screenshots at 3 widths × 2 themes committed to `docs/refresh-2026-09/`.
9. README renders correctly in GitHub light and dark (screenshot both, logged-out view).
10. Research appears below Shipped and Open source in README.

Optional eval (recommended, cheap): blind multi-LLM "recruiter 10-second scan" on before/after above-the-fold screenshots — ≥2 model families, randomized order, fixed rubric (role clarity, impact evidence, credibility, CTA), report inter-judge agreement. Label as LLM-consensus, not human judgment.

## 5. PR triage rules

- Dependabot patch/minor (#208): merge if all gates + build + smoke screenshots pass.
- Dependabot major (#137 eslint 9→10, #135 setup-node 4→7): test on branch; merge only if lint/CI identical; otherwise close with reason and add a Dependabot ignore for that major until upstream support exists.
- Bot content PRs (#124, #125, #206): if superseded, close with link. If current, regenerate on fresh `main`, verify every changed number against its source, then merge.
- #132 (gate fix): correctness fix — rebase, prove each fixed gate fails on a planted defect and passes on clean `main`, merge.
- #152 (docs): rebase and merge if still accurate, else close.
- #99 (semantic search, BL-9): default recommendation close (14 projects do not need semantic search; filter chips + /ask cover it; bundle cost). Keep branch. Reopen only if GG overrules.

## 6. Constraints

- Zero cost: free tiers only.
- Claude Max: never use or set ANTHROPIC_API_KEY.
- No metric stated without source; distinguish verified vs believed in all reports.
- No force-push to `main`; all changes via PR with verifier sign-off.
- Konnect / fashion take-home repos: not listed publicly unless GG approves (D3).

## 7. Decisions needed from GG

- D1: Paper status — "under submission to <venue>" or "preprint, arXiv pending"?
- D2: Demote Research on the site homepage too (recommended: yes — below Work and Open source; keep a /research page).
- D3: List `next-season-styles` / `poi-intelligence-ranking` publicly? (recommended: not until those processes close).
- D4: Pick 1 of 2 visual directions after Phase D proposal.
- T1 (GG hands-on, after Phase C): pin 6 repos on GitHub profile — exact list and steps provided after audit confirms final repo names.

## 8. Reporting format (every phase)

Findings first, then: done / verified-how / evidence path; open items; anything believed-but-unverified labelled so.
