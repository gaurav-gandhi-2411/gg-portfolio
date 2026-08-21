# Audit summary

## What this became

This started as an audit: GG's standing brief, five design waves in, was "still
unsatisfying — audit independently against external references, rebuild with full
design authority, self-verify" (Wave 6, 2026-07-17). It did not stay an audit. Wave
6's diagnosis (`reports/wave6-audit-2026-07-17.md`, written before any code, benchmarked
against five external reference sites) found the site had fixed *scale* across five
waves but never *composition* or *conviction* — and turned into a same-day rebuild:
one grid, two type voices, a deleted carousel, a deleted command palette, sticky
label-column composition. That pattern repeated for the rest of the engagement.
Twelve more waves (7–18) rebuilt navigation, content framing, the `/ask` RAG chatbot,
and the resume/site/repo reconciliation pipeline. A P0 sitewide DOM-crash investigation
on 2026-08-16 overturned a previous session's own root-cause diagnosis mid-fix (View
Transitions was not the cause; a boot-loader `.remove()` race against React's mounted
DOM was) — audit discipline applied to a bug, not a design choice, with the same
result: the assigned fix didn't hold up, and the standard was proving it before
shipping it, not trusting the brief that assigned it.

The most recent phase — the one this document was rewritten to describe — repeated the
shape once more, on a smaller surface. A round-three verification walkthrough of the
live production site (not a preview, not a local build) found real defects a "looks
clean" pass would have missed: a bundled PR that mixed two unrelated chatbot fixes,
three chip-triggered chatbot dead ends the walkthrough reproduced, and eighteen
components still on Tailwind's default transition timing instead of this site's own
motion tokens. Each was root-caused rather than patched on the first guess — one
hypothesis (a retrieval-chunk mismatch between when a follow-up chip is offered and
when it's tapped) was tested directly against production and refuted, and the real
cause turned out to be Groq's own rate limit, silently indistinguishable from an
honest "I don't know" refusal. That indistinguishability is also this document's own
closing fix: PR #191 makes an exhausted-retry transport failure render differently
from a genuine refusal, and makes the uptime canary's actual GitHub-issue alert (not
just its job log) say which one happened. `CHECKS.md`, written across both phases,
names the throughline directly: **"a check that cannot see part of its subject must
say so"** — applied here to a chatbot response as much as to a monitoring script.

## What shipped

### Phase 1 — composition rebuild through content/chatbot build (Waves 3–18, PR #9–#20, 2026-07-13 → 2026-08-05)

- **Wave 3** (PR #9): live-tied metrics (Warmer puzzle count, tracegauge downloads),
  heat-toy interactive, command palette.
- **Wave 4** (PR #11): editorial redesign, one of three divergent concepts chosen.
- **Wave 5**: restraint pass after wave 4 was judged over-scaled; modular type scale.
- **Wave 6+7** (PR #15, squash `9e10805`): the audit-to-rebuild pivot described above —
  one `max-w-5xl` grid, two type voices, carousel and command palette deleted, About
  dissolved into hero + Experience.
- **Waves 8–14**: prototype/production integration; Wave 14 is its own verification-
  discipline wave (`reports/wave14-verification-audit-2026-07-26.md`).
- **Wave 15/16** (2026-07-25/26): content-framing rewrite; the `/ask` RAG chatbot built
  from scratch — hybrid dense+lexical retrieval, a threshold refusal gate, Groq
  JSON-mode generation with server-side citation validation, a 30-case eval harness.
- **Wave 18** (2026-08-05, content-only): site-vs-repo and resume-vs-site number
  reconciliation.
- **P0** (2026-08-16): sitewide DOM-crash fix — root-caused independently after the
  assigned View Transitions removal didn't close it; `e2e/nav-crash-regression.spec.ts`
  added to prevent recurrence of either mechanism.

### Phase 2 — hardening and canary infrastructure (PR #139–#153, 2026-08 through mid-August)

About-section number fixes (#139), live-project-count check fix (#140), em-dash removal
plus its own CI gate (#141/#142), a Lighthouse temp-profile-leak cleanup (#143, the fix
for CHECKS.md instance 20), an adk-tracegauge project card (#144), TriageIQ retrieval
data/results/WebGL work (#145–#148), the Groq model-retirement fix (#149, the incident
`RefusalReason` exists because of), chatbot eval model-provenance (#150), and the
chat-canary apostrophe/quoting fix (#153 — extracting the verdict logic out of an inline
bash single-quoted block into `scripts/chatbot/canary-verdict.mjs`, specifically so that
class of break is structurally impossible again).

### Phase 3 — round-three verification walkthrough and its fixes (PR #177–#191, most recent)

- **#177** search actually narrows the grid, not just the dropdown.
- **#178** removed leaked build commentary and a repo-file link from provenance copy.
- **#179** visible tooltip on the hero social icons, not just an `aria-label`.
- **#180** whole project/research card is a click target, not just the title.
- **#182** diagnosed and fixed four hero defects GG could name symptoms of but not causes.
- **#183** stabilized a category-filter e2e test against a layout race.
- **#184** role-ladder rail for multi-role companies in the Experience section.
- **#185/#186** motion-token pass on shared interactive components; a copy fix.
- **#187** collapse a verbatim-doubled chatbot answer to one copy.
- **#188** pin a follow-up chip's own validated `sourceRef` into its request — split
  out of a single bundled PR (#181) specifically because it and #187 were two
  unrelated defects that didn't belong in one review.
- **#189** retry Groq's own transient 429/5xx instead of refusing once — the fix for
  the true root cause behind all three chatbot "dead ends" the round-three walkthrough
  reproduced (confirmed via production runtime logs, not guessed: `[llm-provider] groq
  returned 429` at ~80ms latency, retrieval itself healthy every time).
- **#190** the remaining 18 components still on Tailwind's default transition timing,
  including the `/ask` composer's own submit button, moved to this site's `--dur-*`/
  `--ease-out-soft` tokens.
- **#191** (this round) an exhausted-retry `provider_unavailable` now renders
  `SERVER_ERROR_MESSAGE` ("try again") instead of the generic refusal ("ask something
  else") — genuinely different, actionable advice for a visitor, since the question and
  corpus were both fine and only the completion call didn't come back. The chat-canary's
  failure-issue body now carries the `refusalReason` + runbook text that used to reach
  only the job's own console log, so an on-call human reading the GitHub issue can tell
  a Groq outage apart from a real regression without opening the Actions log by hand.

## Before / after numbers

| What | Before | After | Source |
|---|---|---|---|
| Wave 6 rebuild — Lighthouse Performance | 79 | **100** | `reports/wave6-composition-rebuild-2026-07-17.md` |
| Wave 6 rebuild — LCP | 3.32s | **0.6s** | same (the wave-4 "framework floor" was a reveal layer holding sections at `opacity:0`; deleting it, not a perf trick, un-stuck LCP) |
| Wave 6 rebuild — eager JS (gzip) | 204,618 B | **189,608 B** | same, ceiling 220,160 B |
| UI/UX pass (2026-07-30) — eager JS | — | 169,504 B | vs. 220,160 B ceiling |
| UI/UX pass — e2e | — | 74 desktop + 72 mobile green, axe 0 across 22 routes | Lighthouse 100/96/100/100, LCP 323ms, CLS 0.00 |
| Wave 16 chatbot build — e2e | — | 131/132 (1 pre-existing, unrelated) | Lighthouse home 91/100/96/100 (412 KiB), `/ask` 92/100/96/100 (392 KiB) |
| P0 crash — local repro rate, `main` | 6/8 hit | **0/24** (post-fix stress test) | headed Playwright, production build |
| P0 crash — production repro rate | 10/10 cycles produced an error, 3/10 hard crash | **0/8** (post-fix sanity suite against the fix branch's preview) | direct load against `gaurav-gandhi.vercel.app`, not a preview |
| Round-three chatbot walkthrough — dead ends | 3/3 paths hit a refusal (first paced re-test attempt) | **0/30 turns across 3 paths** (final re-test, rate-limit-paced against production) | PR #189 (Groq retry) + #187/#188 |
| Round-three motion sweep | 18 components on Tailwind-default transition timing | **0** — all on `--dur-fast`/`--dur-base` + `--ease-out-soft` tokens | PR #190 |
| This round — e2e (full suite, `fix/chatbot-transport-failure-distinct`) | — | 492 passed, 1 pre-existing unrelated flake (`hero-socials.spec.ts` mobile hover, confirmed to pass in isolation) | PR #191 |
| This round — chatbot lib unit tests | — | 50/50 pass | `node --test lib/**/*.test.ts` |

The first "final re-test" attempt of the round-three walkthrough is deliberately not
in this table as a defect count: it hit *this app's own* IP rate limit (a leftover
elevated counter from the diagnosis session's own earlier requests, not a chatbot bug),
and was rerun with a 12-minute cooldown before being reported. Distinguishing "the app
rate-limited us" from "the chatbot failed" was itself an instance of the exact
collapse PR #191 now fixes for a real visitor — logged in the test script as
`APP-RATE-LIMIT-429` rather than folded into the dead-end count, for the same reason.

## What was deliberately not shipped, and why

- **Wave 2's initial JS-budget miss (161.3 KiB against a since-corrected number)** —
  left open that wave rather than force a same-day fix; resolved naturally by Wave 6's
  deletions.
- **Wave 3 Tier 3.7 (dynamic per-section OG images)** — cut. The brief's own trigger
  condition (per-section routes existing) never applied.
- **Wave 3's dark-theme exploration** — held on `explore/dark-theme-candidates`,
  deliberately not merged; GG's pick was never made, so it stayed a branch.
- **PR #44** — closed, not merged. Would have reverted correct fixes; the risk of
  landing it exceeded the value of whatever it was trying to fix.
- **Style Maitri's higher-looking accuracy numbers (94.4%, n=378)** — reverted to the
  lower, git-verified numbers (93.8%, n=211) specifically because the higher figures
  traced only to gitignored, undated local reports. Per this engagement's own standing
  rule: no dated, committed artifact means it doesn't ship, even when shipping it would
  have made the number look better.
- **Wave 16's chatbot eval baseline** — shipped with placeholder "pending" copy rather
  than a fabricated number, because no live `GROQ_API_KEY` was available in the
  environment that would have produced a real one.
- **Wave 16's `/projects` hover-contrast accessibility fix** — attempted, hit a second,
  harder compounding case, and was reverted rather than ship a partially-understood
  tweak outside that wave's stated scope. Flagged as a named follow-up, not silently
  dropped.
- **PR #118's View Transitions mitigation** (`perf/lcp-final`) — reverted outright once
  the P0 investigation proved it was the wrong root cause; kept as a draft PR, not
  deleted, so the wrong diagnosis stays visible rather than disappearing.
- **The case-study chat launcher hiding at `lg+` and above** (an earlier density fix) —
  accepted as a deliberate tradeoff against the sticky right rail's own CTAs, explicitly
  flagged to revisit only if usage data ever shows it costing the chatbot funnel.
- **The phantom 16px horizontal-scroll finding on `/` at 390px** — left alone this
  round on GG's explicit instruction, because it had already been correctly diagnosed
  as a deliberate `overflow-clip-margin` trade-off protecting focus-ring visibility;
  nothing renders in the affected band, so there is nothing to fix.
- **A general "the walkthrough concludes clean" report** — deliberately not accepted as
  a substitute for evidence, twice, on GG's own instruction: a prior "clean" conclusion
  on search had already been shown false once, and the round-three re-test was ordered
  specifically because the first "the fix works" report from #188 alone was wrong (3/3
  paths still failed). The standard applied going forward was one-line, observed,
  on-the-rendered-page evidence per claim, not a narrative summary.

## `CHECKS.md`: the twenty-eight

`CHECKS.md`'s own organizing rule: **a check must report non-coverage as a distinct,
visible state — never as silence.** Instances 1–15 come from the audit phase and are
mostly cross-repo GCP/infra findings (billing, monitoring, identity); 16–28 come from
gg-portfolio's own design rebuild and extend the same pattern to tests, gates, and
measurement tooling rather than repeating it. Full detail, evidence, and the fix for
each lives in `CHECKS.md` — this is the index, not a replacement.

1. **`source_line` read by nothing** — a metric's cited line pointed at the wrong row and still passed, because the check searched the whole file for the number rather than that line.
2. **`SKIPPED` printed nowhere** — four metrics silently uncompared, invisible because the output looked clean.
3. **The `${id}-baseline` inference** — a guessed key silently failed for one real ID; fixed by declaring the link instead of inferring it.
4. **`.find()` on the first matching row** — a second row citing the same ID was silently never checked.
5. **A prose claim standing in for evidence** — complying with the screenshot gate (rather than arguing an exemption) surfaced a real bug: five suggested-question chips left on screen in a state whose purpose was to stop offering them.
6. *(numbering in the source continues at 8; the between-entries are folded into 5's writeup)*
7. **Same week, same family** — WebGL invisible to CI (≤4 cores), axe forcing reduced-motion off a WebGL layer, a behavior test asserting one exact sentence.
8. **A check's true positives arrive pre-labelled as noise** — a real Cloud Run 503 was explained away by two pre-written dismissals naming exactly that failure as expected; retries had already proven it wasn't (4 attempts, ~105s) but the tool discarded the evidence that they'd run.
9. **`2>/dev/null` made "nothing exists" and "I could not look" identical** — a GCP resource sweep's suppressed stderr turned `PERMISSION_DENIED` into an apparent clean zero.
10. **The check ran correctly, against the wrong target** — two products called "down" by probing an address they'd migrated away from; the evidence that a service moved lives outside the service.
11. **Traffic-derived alerting cannot see a service that never starts** — a scale-to-zero instance that can't cold-start serves zero requests, which is indistinguishable from a quiet, healthy night to every alert built on served-traffic metrics.
12. **A guard that reports "could not verify" as "catastrophic outage"** — a billing check's own `gcloud` call failing (not billing being off) fired a false, fully-cited outage alarm during a real 61-second-cold-start-proves-healthy window; the worst variant, because a false alarm teaches its reader to stop trusting the one signal that most needs believing.
13. **A synthetic test value read as production fact** — a kill-switch's own dry-run verification payload was read as a live ₹2,600 overspend and used to disarm a working production safety control for fourteen minutes; the disproof (₹0.00 actual spend, same log stream, seconds away) was never read.
14. **Config and reality diverged, and nothing was watching** — Terraform state said `DRY_RUN=false`; a later manual deploy could silently disagree, and nothing runs `terraform plan -detailed-exitcode` on a schedule to notice.
15. **Two agents, one credential file, an identity that changed mid-task** — a shared, machine-global `gcloud` config flipped accounts mid-migration; every resulting permission failure was misdiagnosed as IAM or propagation lag instead of "who is running this command."
16. **A test that was green, specific, and defending the defect** — a sticky header's contraction test asserted the header got shorter; the real bug was that the still-in-flow sticky band moved every element below it by 16px on scroll. Written from the implementation, so it could only ever agree with it.
17. **A negative margin invisible until the row wrapped** — `-my-[5px]` on filter pills caused a 2px hit-test overlap the moment the row wrapped on phone widths; no standard a11y check tests tap-target *overlap*, only size. Found only because a Playwright click took 3.7s and got dismissed as "flaky" first.
18. **Four checks whose coverage was set by a formatting convention** — a separator, an indent, a filename, an import spelling each silently shrank what a gate covered while reporting success over the smaller set; the chatbot eval reported 100% recall by having one fixture file renamed out of its own glob.
19. **A test that passed because it was faster than the thing it raced** — an unscoped `getByText` locator resolved before a second, later-rendered match existed, so it "passed" for weeks by winning a race, then failed under real machine contention wearing the costume of a flake.
20. **A tool that leaked into the machine it was measuring** — a Lighthouse runner's per-run Chrome profile cleanup silently failed on Windows; 265 leaked directories (3.2 GB) eventually corrupted the very performance numbers being measured.
21. **A one-line style write that restyled the whole document** — a custom CSS property set on `<html>` cost 86× a normal property write because it invalidated the entire inheriting subtree; paired with a wrong explanation ("preview vs. production can't matter") that survived several rounds of measurement until the variable was actually removed rather than argued about.
22. **A gate that was correct, complete, and never ran** — CI's own triggers didn't cover long-lived feature branches with no PR open; 31 commits, including one that blew the JS budget by 52,795 bytes, passed through completely unseen.
23. **An exemption that was correct when written and became wrong by outliving its reason** — a merge-gate override keyed on a bare file path, not the PR that justified it, got silently reapplied to an unrelated twelve-line change months later.
24. **Two disclosure checks that couldn't match their own subject** — regex patterns requiring an exact one-character gap rejected the natural way anyone would actually phrase a compliant disclosure.
25. **A rule's prose and its implementation drift** — three separate wrong conclusions from reading a rule's *description* instead of its committed code, including once from another workstream's uncommitted working copy mistaken for the live mechanism.
26. **A guard that can only ever read the copy of itself sitting next to it** — a merge hook resolves its gate by a hard-coded sibling file path, so a fix merged to `main` doesn't reach it until that specific checkout's copy is updated; blocked two real merges the same afternoon.
27. **A metric that improved because the measurement window closed early** — deferring expensive WebGL work past first paint improved a headline TBT number on Lighthouse runs too short to reach it, while the total cost was unchanged on runs that ran long enough to see it.
28. **A suite that graded a different worktree's build for a full run** — a fixed `localhost:3000` baseURL let Playwright silently adopt another worktree's stale dev server; 381 tests passed while testing the wrong branch's build entirely, surfaced only by luck when that server later went stale and started 500ing mid-run.

**The tell**, stated once at the end of `CHECKS.md` and worth repeating here: *ask of any
check — if the thing it guards broke right now, would this produce output? If the honest
answer is "it would go quiet," the check is decorative.* PR #191 is that question asked
of the chat canary specifically: before this round, a real Groq outage and a healthy day
both produced the identical alert body.
