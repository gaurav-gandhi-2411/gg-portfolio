## 3. Issue audit and repo-rename truth

Scope: open issues #122, #123, #200 on `gaurav-gandhi-2411/gg-portfolio`, plus the F7/F15-driven
question of whether `adk-tracegauge` was renamed and where the `tracegauge` PyPI package's source
truly lives. Read-only — nothing edited, commented, or closed. No paid APIs used; only `gh`,
`curl` against public GitHub/PyPI endpoints, and local file reads in the audit worktree.

All three issues confirmed open via `gh issue view <N> --repo gaurav-gandhi-2411/gg-portfolio
--json number,title,body,comments,createdAt,updatedAt,labels` — **verified**. None have any
comments (bot or human) beyond the opening body.

---

### 3.1 — Issue #200: "Identity drift: adk-tracegauge renamed"

**Full contents** (createdAt 2026-08-24T03:48:25Z, updatedAt 2026-08-24T03:48:25Z, no labels, 0
comments) — **verified**, `gh issue view 200`:

> The weekly identity-drift check (scripts/identity-drift.mjs) found that
> [`https://github.com/gaurav-gandhi-2411/adk-tracegauge`](https://github.com/gaurav-gandhi-2411/adk-tracegauge)'s
> README H1 changed:
>
> - Was: **null**
> - Now: **adk-tracegauge**
>
> content/products.ts still lists this product as "null" — decide whether the site name should
> follow the repo's rename, or whether this is an intentional divergence (several tracked products
> already use a nicer site name than their raw README, e.g. "Samidha Reviews" vs. review-iq's own
> README). Closing this issue is fine once addressed; it reopens/recreates next time the README
> name changes again.

**#200 SPECIAL TASK — establishing the true current names:**

1. `gh repo view gaurav-gandhi-2411/adk-tracegauge --json name,description,url` returns the repo
   directly, no error — **verified**: it exists right now under this exact name.
2. `curl -sI https://github.com/gaurav-gandhi-2411/adk-tracegauge` → `HTTP/1.1 200 OK`, direct
   render, **no redirect** (no 301/302, no `Location` header) — **verified**. This is not a
   renamed-repo redirect landing page; it is the repo's live, canonical name.
3. `gh api repos/gaurav-gandhi-2411/adk-tracegauge` resolves directly to the same repo (id
   1333165832, full_name `gaurav-gandhi-2411/adk-tracegauge`) — **verified**. GitHub's API does not
   redirect a same-name lookup; if the repo had been renamed away from `adk-tracegauge`, this call
   would 404 the way it does for `tracegauge` below.
4. `gh repo view gaurav-gandhi-2411/tracegauge` and `gh api repos/gaurav-gandhi-2411/tracegauge`
   both return `404 Not Found` / GraphQL "Could not resolve to a Repository". `curl -sI
   https://github.com/gaurav-gandhi-2411/tracegauge` also returns a plain `404 Not Found` with no
   `Location` header — **verified**. A true GitHub rename produces a 301 redirect to the new name;
   a bare 404 means this exact string has never been a repo name under this account, not that it
   was renamed away.
5. `curl -s https://pypi.org/pypi/tracegauge/json` — **verified**, PyPI's own `project_urls` for
   the `tracegauge` package (version 0.13.0) is:
   ```json
   { "Repository": "https://github.com/gaurav-gandhi-2411/token-efficiency-scorer" }
   ```
6. `curl -s https://pypi.org/pypi/adk-tracegauge/json` — **verified**, PyPI's `project_urls` for
   the separate `adk-tracegauge` package (version 0.9.1) is:
   ```json
   {
     "Changelog": "https://github.com/gaurav-gandhi-2411/adk-tracegauge/blob/main/CHANGELOG.md",
     "Documentation": "https://github.com/gaurav-gandhi-2411/adk-tracegauge#readme",
     "Homepage": "https://github.com/gaurav-gandhi-2411/adk-tracegauge",
     "Issues": "https://github.com/gaurav-gandhi-2411/adk-tracegauge/issues",
     "Repository": "https://github.com/gaurav-gandhi-2411/adk-tracegauge"
   }
   ```

**#200 conclusion (definitive):**

- **`adk-tracegauge` never renamed.** Repo A's canonical name today is exactly `adk-tracegauge`,
  unchanged. It is a live, non-fork, non-archived, public GitHub repo, and its PyPI package
  (`adk-tracegauge`, v0.9.1, 17 releases per `gh api graphql` release count — **verified**) declares
  its own Homepage/Repository/Changelog/Issues URLs all pointing back at this same repo name. No
  redirect exists because there was nothing to redirect from.
- **`tracegauge` is a genuinely different, separate PyPI package** (v0.13.0) that has never had a
  same-named GitHub repo — there is no "repo B named tracegauge" to compare against; the comparison
  is package-vs-repo, not repo-vs-repo. Per **PyPI's own, self-declared** `project_urls.Repository`
  field (not an inference, not a guess — the literal string returned by PyPI's JSON API), the
  `tracegauge` package's source genuinely lives at `gaurav-gandhi-2411/token-efficiency-scorer`.
  **The site's existing claim (spec F7: "site links tracegauge source to repo
  `token-efficiency-scorer`") is correct, not drift**, and needs no fix.
- **Issue #200 is not actually about any of the above.** Re-reading `scripts/identity-drift.mjs`
  (design comment at lines 121–130) and its "renames" derivation: the "Was: null / Now:
  adk-tracegauge" pair is a diff between two runs' *cached* values in
  `content/identity-state.json` (a machine-owned cache of each product's live README H1), never a
  diff against `content/products.ts` directly, and never evidence of an actual GitHub rename. The
  cache's stored `adk-tracegauge` entry was `null` as of its last write (`updated_at: 2026-08-10`,
  **verified** by reading `content/identity-state.json` directly), most likely because the README
  fetch failed or had no parseable `# H1` line at that check. The next run correctly resolved the
  README's H1 as "adk-tracegauge" and recorded that as a diff — a cache going from empty to
  populated, not a rename.
- **The issue's core actionable claim is false and was already false when the issue was
  opened.** `content/products.ts` does **not** say `"null"` — it has said `name: "adk-tracegauge"`
  since commit `4dd6112` ("feat(projects): adk-tracegauge, a cost gate anyone can install"),
  **verified** via `git log`/`git show`, dated 2026-08-18T15:31:07+05:30 — six days *before* issue
  #200 was even opened (2026-08-24). Current `content/products.ts` (grepped directly, line 204-215)
  confirms `slug: "adk-tracegauge"`, `name: "adk-tracegauge"` today.
- **Root cause is a template bug**, not a content gap: `.github/workflows/metrics-refresh.yml`
  line ~300 hardcodes the issue body to assert `` content/products.ts still lists this product as
  "${entry.oldName}" `` — it asserts this without ever actually reading `content/products.ts`. It
  is simply wrong whenever `entry.oldName` (the stale cache value) no longer matches the real file,
  which is exactly what happened here.

**Proposed resolution for #200:** close as resolved — `content/products.ts`'s name already matches
the README H1 (`"adk-tracegauge"` both places), no site content change needed. Separately (Phase
B/hygiene, not blocking this close): fix the issue-body template at
`.github/workflows/metrics-refresh.yml`'s "Open/update per-repo issues for README renames" step so
it states the cached old value as what the *cache* held, not as a live claim about
`content/products.ts`'s current contents — or better, have it actually re-read
`content/products.ts`'s current `name` field before asserting a mismatch, so a future genuine
divergence isn't lost in the noise of another false one like this.

---

### 3.2 — Issue #122: "New public repos not yet on the portfolio site"

**Full contents** (createdAt 2026-08-17T03:43:20Z, updatedAt 2026-08-31T09:11:22Z, no labels, 0
comments) — **verified**, `gh issue view 122`:

> Found by the weekly metrics-refresh run — these are public, non-fork, non-archived repos under
> gaurav-gandhi-2411 that aren't linked from any product on the site and aren't in
> `KNOWN_NON_PRODUCT_REPOS` (scripts/refresh-metrics.mjs).
>
> - [`eval-defect-bench`](https://github.com/gaurav-gandhi-2411/eval-defect-bench) — A held-out
>   benchmark for a class of silent-verdict-degradation bugs, plus 3 detection baselines (AST,
>   local LLM consensus, frontier judge) that all failed a pre-registered viability gate.
> - [`gaurav-gandhi-2411`](https://github.com/gaurav-gandhi-2411/gaurav-gandhi-2411) — GitHub
>   profile README
>
> If a repo here is a real project, it needs a case study (content/case-studies/) at the same
> depth as the other 12 — see reclaim's wave-14 addition for the process. If it's a support repo,
> add its name to `KNOWN_NON_PRODUCT_REPOS`. Closing this issue is fine once addressed; it
> reopens/recreates next time something new shows up unaddressed.

**Re-verification against live state** (not trusting the issue text) — `gh repo list
gaurav-gandhi-2411 --json name,isPrivate,description,pushedAt --limit 100`, cross-referenced with
`gh repo list ... --json name,isFork,isArchived`, `content/products.ts`'s `repoUrl:` list (13
distinct repos referenced, plus Warmer which has no public repo — mindmeld is private), and
`scripts/refresh-metrics.mjs`'s current `KNOWN_NON_PRODUCT_REPOS = ["gg-portfolio",
"mindmeld-payloads", "triage-iq-ui"]` — **verified** by direct grep of the script.

Computing "public, non-fork, non-archived, not referenced by any product, not in the allowlist"
myself (not trusting the issue's list) gives **four** repos today, not the two the issue names:

| Repo | In issue #122? | createdAt | Status |
|---|---|---|---|
| `eval-defect-bench` | Yes | 2026-08-30 | Real, unaddressed |
| `gaurav-gandhi-2411` (profile repo) | Yes | 2026-08-10 | Real, unaddressed |
| unlisted repo 1 (owner decision D3) | **No** | 2026-09-19 | Real, missing from the issue |
| unlisted repo 2 (owner decision D3) | **No** | 2026-09-18 | Real, missing from the issue |

Both unlisted repo 1 and unlisted repo 2 (owner decision D3) are the repos spec.md's constraints
section already names ("Konnect / fashion take-home repos... not listed publicly unless GG
approves (D3)") — so their *absence from the site* is intentional per D3, but their absence from
this bot issue is not a decision anyone made; it's a live automation defect (see below), and it
means the issue's own "these are the new repos" claim is currently **incomplete**, not just stale.

**Why the bot missed them — traced to a real, currently-live defect, not guessed:**

I pulled the last 5 weekly `metrics-refresh.yml` runs (`gh run list --workflow=metrics-refresh.yml`)
and grepped each run's log for the repo-inventory step:

| Run (schedule date) | Repo-inventory fetch | New repos detected |
|---|---|---|
| 2026-08-24 | succeeded | `eval-defect-bench`, `gaurav-gandhi-2411` (updated issue #122 same day — matches its `updatedAt`) |
| 2026-08-31 | succeeded | none new (correct — the other two repos didn't exist yet) |
| 2026-09-07 | succeeded | none new (correct, same reason) |
| 2026-09-14 | succeeded | none new (correct, same reason) |
| **2026-09-21** | **failed: `Repo inventory check unavailable this run (HTTP 403).`** | **none reported — but two real new repos existed by then** |

The 2026-09-21 run log (`gh run view 35577982002 --log`) literally contains:
```
- Repo inventory check unavailable this run (HTTP 403).
```
— **verified**, grepped directly out of the run log; this line is absent from the 09-07 and 09-14
run logs (also verified by grep), so this is not a permanent/every-run failure, it's specific to
the most recent run. Unlisted repo 1 (owner decision D3, created 2026-09-19) and unlisted repo 2
(created 2026-09-18) both existed before this run executed (2026-09-21T08:27), so a working
inventory fetch should have caught them.

**Mechanism** (read directly from `scripts/refresh-metrics.mjs`, lines 260–276): the repo-inventory
fetch calls `https://api.github.com/users/${GITHUB_AUTHOR}/repos?per_page=100&type=public` via a
shared `fetchJson()` helper that sends only `{ headers: { Accept: "application/json" } }` — **no
`Authorization` header**, confirmed by reading the helper's definition. GitHub's anonymous rate
limit is 60 requests/hour; this workflow runs four jobs in the same scheduled trigger
(`identity-drift`, `refresh`, `metric-freshness`, `content-pipeline`, all visible as parallel
job-name prefixes in the same run's log), several of which also call `api.github.com` per-product
for README/repo-metadata checks — enough concurrent anonymous calls to plausibly trip a 403
(secondary rate limit or primary limit) on any given week. I did not reproduce the exact 403 (I
can't replay the exact request volume/timing GitHub Actions saw), so the *specific trigger* is
believed, not directly reproduced — but the 403 itself, and the fact this exact call carries no
auth token, are both directly verified from the log and the script source respectively.

**This is the shape CLAUDE.md rule 98a warns about, live, not hypothetical**: on `catch`, the
script does `notes.push(...)` (a passive log line) but `newRepos` stays `[]` because it was
declared `const newRepos = []` before the `try` block and the `try` never got to populate it — so
`/tmp/new-repos.json` is written as `[]` regardless of whether the fetch actually ran and found
nothing, or never ran at all. The downstream step (`if [ "$(cat /tmp/new-repos.json)" = "[]" ];
then echo "No new repos found this week."`) cannot tell these two cases apart, so a real fetch
failure silently renders as "no new repos" — the exact fail-open shape, not fail-closed.

**Proposed resolution for #122 (per item):**

1. `eval-defect-bench` — real, genuine, still unaddressed. Recommend a case-study addition (Phase
   C), not a `KNOWN_NON_PRODUCT_REPOS` suppression — its description ("3 detection baselines that
   all failed a pre-registered viability gate") is exactly the honest-negative-result content this
   portfolio already documents elsewhere (Gold Rate Tracker's naive-wins framing, agentgauge's
   heuristic-pivot). GG's call on depth/timing, but it should not be silently suppressed.
2. `gaurav-gandhi-2411` (profile repo) — this will permanently exist and is never itself a
   "product" to case-study. Recommend adding it to `KNOWN_NON_PRODUCT_REPOS` in
   `scripts/refresh-metrics.mjs` so this line item stops recurring every week.
3. Unlisted repo 1, unlisted repo 2 (owner decision D3) — real, currently invisible to the automation
   due to the 403 above, and covered by spec's D3 (not listed publicly pending GG's decision on the
   take-home-adjacent status). Recommend: once D3 is decided, either add both to
   `KNOWN_NON_PRODUCT_REPOS` with a comment citing D3 (if the decision is "never list"), or leave
   unlisted with an explicit skip-reason if D3 resolves to "pending" — either way, don't leave them
   silently undetected.
4. **Separately from the four repos above**: fix the fail-open defect itself
   (`scripts/refresh-metrics.mjs`'s repo-inventory `catch` block) so a fetch failure is
   distinguishable from a genuine empty result — e.g. write a sentinel (`null` or a `{failed: true}`
   wrapper) instead of leaving `newRepos` as `[]`, and have the downstream bash step treat that
   sentinel as "check did not run this week, retry," not as "nothing found." This is the actual
   root cause of #122 going stale, not (only) backlog neglect — F15's "weekly automations open work
   nobody drains" is real for #123/#200, but #122's staleness this week is a genuine tool defect,
   worth stating separately.

---

### 3.3 — Issue #123: "Weekly metric freshness check: drift, unverifiable metrics, or overdue verification"

**Full contents** (createdAt 2026-08-17T03:43:30Z, updatedAt 2026-09-21T08:27:52Z, no labels, 0
comments) — **verified**, `gh issue view 123`. This is a long, multi-section auto-generated report;
reproducing verbatim here since the task requires full contents:

> ## Weekly metric freshness check — 2026-09-21
>
> Re-checks each tracked metric's numbers against its cited source file's CURRENT content (not
> against the source repo's own possibly-stale `.portfolio/metrics.json` manifest — see
> scripts/check-metric-freshness.mjs's header for why that distinction matters). A text-presence
> check, not a re-measurement: it can miss drift where the old number coincidentally still appears,
> but a confirmed absence is real signal.
>
> ### Possible drift — 2 metric(s) (needs a human look)
>
> - `style-maitri:catalogue-size`: none of [52,494] (or their %/fraction equivalent) found in
>   current gaurav-gandhi-2411/agentic-shopping-assistant/reports/soldout_filter_fix_2026-07-12.txt
>   (value: "52,494 items across 8 stores")
> - `reviewiq:extraction-eval`: none of [83.8] (or their %/fraction equivalent) found in current
>   gaurav-gandhi-2411/review-iq/eval/report.md (value: "83.8% overall")
>
> ### Summary: 20 current, 2 possible drift, 0 partial drift, 0 unverifiable, 0 structurally
> unverifiable, 2 skipped (no fetchable path or no numeric tokens)
>
> _Metric coverage: content/metrics.json's tracked product-card metrics only..._
>
> ## Case-study claim coverage (results/decisions/story, not just product-card metrics)
>
> **Checked (fetch attempted): 72 of 94 numeric claims** (70 current, 1 possible drift, 1 partial
> drift, 0 unverifiable). 58 more claims are prose with no numeric anchor.
>
> ### Possible drift — 1 claim(s)
>
> - `style-maitri` (result, `style-maitri:catalogue-size`): none of [52,494] found in
>   gaurav-gandhi-2411/agentic-shopping-assistant/{reports/soldout_filter_fix_2026-07-12.txt}
>
> ### Partial drift — 1 claim(s)
>
> - `reviewiq` (result, `reviewiq:extraction-eval`): 1/5 token(s) confirmed present across
>   gaurav-gandhi-2411/review-iq/{eval/report.md}, but missing: [83.8, 86.2, 80.7, 80.9] (text:
>   "83.8% vs. an 83% CI gate, PASS per-language: en 86.2% / hi 80.7% / hi-en 80.9% (2026-07-06 eval
>   run)")
>
> ### 8 claims UNCHECKED (no auth) — private source repo (all 8 are Warmer/mindmeld metrics)
>
> ### 14 claim(s) numeric, but not checked this run (no provenance row / no extractable path)
>
> ## SVG-embedded metric coverage (gh-profile banner)
>
> **2 SVG/metric pairs tracked**: 0 current, 2 possible drift.
>
> - `assets/banner-light.svg` / `warmer:hinglish-fix`: "0.813" not found in
>   `<text class="mval">` content (found: [−0.003 → 0.813 after fine-tuning])
> - `assets/banner-dark.svg` / `warmer:hinglish-fix`: same
>
> ## Case-study verification staleness (>30 days) — 14 case studies overdue (34–52 days), listing
> every product except triageiq's frontend companion and Warmer's public data mirror.
>
> ## Commit-SHA reachability — 24/24 reachable, 0 unreachable.
>
> ## Cited-line content — 22 line-match, **1 LINE MISMATCH**, 1 qualitative (correct as-is):
>
> - `style-maitri:catalogue-size`: reports/soldout_filter_fix_2026-07-12.txt:28 at db4a6ed does not
>   contain "52,494" — that line reads: "Catalogue size: 61,883 -> 52,494 items (-9,389 net; the
>   gross Shopify drop of 10,194 is partly offset..."

**Item-by-item re-verification (fetched the actual current source files, not trusting the bot's
conclusions):**

**(a) `style-maitri:catalogue-size` — FALSE POSITIVE, no content fix needed.** I fetched the exact
cited file at the exact cited commit: `curl -s
https://raw.githubusercontent.com/gaurav-gandhi-2411/agentic-shopping-assistant/db4a6ed/reports/soldout_filter_fix_2026-07-12.txt`
— **verified**, the file's relevant line literally reads `Catalogue size: 61,883 -> 52,494 items
(-9,389 net; the gross Shopify drop of 10,194 is partly offset by normal Phase-A cleaning variance
across all 8 stores, not just the 4 re-synced ones).` — `52,494` is plainly present, both at the
file level and on the specific cited line. The bot's own "LINE MISMATCH" detail message *quotes
this exact line containing "52,494"* while simultaneously claiming the number isn't there — that
contradiction is the tell. Reading `scripts/check-metric-freshness.mjs`'s
`CHANGELOG_TRANSITION_PATTERN` (lines 585+) and its own design comment (lines 575–584) explains it:
the checker deliberately excludes numbers inside arrow-joined "before → after" spans (`\d... ->
\d...`) from its presence search, specifically to avoid a stale "before" number giving a false
CURRENT read — and the source line's "61,883 -> 52,494" matches that exclusion pattern, so **both**
numbers get stripped from consideration on that line, not just the stale one. The script's own
comment states this exact trade-off is deliberate and accepted ("a headline number that only ever
appears inside its own changelog sentence... would report POSSIBLE_DRIFT under this fix even while
correct — a real, stated trade... not hidden"). This is a known, accepted tool limitation, not
actual metric drift. **No content change needed; safe to note as a documented false positive when
closing/updating #123.**

**(b) The two `warmer:hinglish-fix` SVG entries — FALSE POSITIVE, same root cause.** I fetched
`assets/banner-light.svg` from the profile repo directly
(`https://raw.githubusercontent.com/gaurav-gandhi-2411/gaurav-gandhi-2411/HEAD/assets/banner-light.svg`)
— **verified**, the `<text class="mval">` node literally contains `−0.003 → 0.813 after
fine-tuning`. `0.813` is plainly present. This hits the identical `CHANGELOG_TRANSITION_PATTERN`
exclusion as (a): the mval text is itself an arrow-joined transition, so the checker's own
extraction strips both `-0.003` and `0.813` before comparing. Same documented, accepted trade-off,
same conclusion: **false positive, no SVG regeneration needed for this reason** (rule 65c would
apply if this metric's value had genuinely changed — it hasn't).

**(c) `reviewiq:extraction-eval` — CONFIRMED REAL, genuine drift, needs a fix.** I fetched the
exact cited file, current `HEAD`:
`https://raw.githubusercontent.com/gaurav-gandhi-2411/review-iq/HEAD/eval/report.md` — **verified**,
full current contents:
```
# Eval Report
Generated: 2026-09-19 21:59 UTC
## Overall: 78.6% PASS (threshold 76%)
## Per-language
| Language | Score | Gate | Status |
|----------|-------|------|--------|
| en | 78.2% | 77% | PASS |
| hi-en | 79.3% | 75% | PASS |
```
None of the site's cited numbers (83.8, 86.2, 80.7, 80.9) appear anywhere in the current file —
confirmed via direct grep, zero matches. This is not a false positive from the changelog-transition
pattern (no "→"/"was...now" framing near these numbers) — the underlying eval genuinely re-ran
(generated timestamp 2026-09-19) with a materially different result and a **different
per-language breakdown entirely** (only `en`/`hi-en` now; the site's cited "hi 80.7%" language row
no longer exists in the report at all), and different gate thresholds (76%/77%/75% vs. the site's
cited 83%). **This is real, confirmed drift** — `content/metrics.json`'s `reviewiq:extraction-eval`
entry and any case-study prose repeating "83.8%"/"86.2%"/"80.7%"/"80.9%" need updating to the
current 78.6%/78.2%/79.3% figures (or whatever figure content owners choose to promote), with a
fresh `verified` date, per rule 65c (a metric change must ship with the regenerated copy in the
same PR, not as a deferred step).

**(d) 8 unchecked Warmer/mindmeld claims** — genuinely unverifiable by this tool (private source
repo, no credential carried) — **believed** accurate as stated in the issue; I did not attempt to
fetch the private `mindmeld` repo (would require auth this task is not scoped to use, and doing so
risks touching credentials outside this read-only audit's remit). Flagged, not resolved, correctly
labelled "not covered" rather than "passing" in the issue itself, which matches rule 98a's intent
even though this specific check isn't the automation described there.

**(e) 14 case studies overdue for re-verification (34–52 days)** — a real, mechanical staleness
list (dates are simply `verifiedAt` fields read from `content/types.ts`-typed content vs. today);
not something to re-derive by hand for 14 case studies in this section — this is Phase C/re-audit
work, correctly flagged as a to-do, not a false positive.

**(f) Commit-SHA reachability (24/24) and 22/24 cited-line matches** — no action needed; both are
genuinely clean per the bot's own check, and I have no reason from (a)/(b) above to distrust a
"CURRENT"/"reachable" result (the false-positive mechanism found here only produces false
*drift*/*mismatch* reports, never a false "current," since it can only ever remove candidate
numbers from consideration, making the check strictly more likely to under-match, never
over-match).

**Proposed resolution for #123:** update `content/metrics.json`'s `reviewiq:extraction-eval` entry
and any case-study copy citing the old 83.8/86.2/80.7/80.9 figures to the current report's numbers,
with a fresh `verified` date and commit SHA (item c — the one genuine finding). Close or
update-in-place the rest of the issue noting items (a) and (b) as confirmed false positives from
`check-metric-freshness.mjs`'s own documented `CHANGELOG_TRANSITION_PATTERN` trade-off (no content
fix needed, but worth a maintainer note in the script's `CHANGELOG_TRANSITION_PATTERN` comment
block pointing at this specific real-world case, since the comment already anticipated exactly this
shape). The 14-item staleness list and 8-item private-repo gap are legitimate backlog, not this
section's per-item fix — surfaced for Phase C planning.

---

### 3.4 — Summary against F15

F15 states: "3 open bot issues (#122, #123, #200)... Root cause: weekly automations open work
nobody drains." That framing is correct for #123's staleness backlog and for #200's stale-cache
noise, but **incomplete** for #122: this audit found a live, verifiable automation defect (the
silent-pass-on-HTTP-403 shape in `scripts/refresh-metrics.mjs`'s repo-inventory check) that means
#122 is not just undrained, it is currently **incomplete** — two real repos
(unlisted repo 1, unlisted repo 2 — owner decision D3) exist and are invisible to the bot today. Both
findings (drain the backlog, AND fix the fail-open repo-inventory check) should go into Phase B.
