# Wave 15 — content framing, progressive disclosure, agentic pipeline (2026-07-25)

GG's brief: rewrite every case study's framing to lead with capability (not the failure), add
progressive disclosure to the work grid, replace the metric-refresh pipeline with a multi-agent
content pipeline, audit manifest/CI coverage across all 17 repos, migrate expense-tracker onto
review-iq's Supabase project, and ship five forward-looking enhancements. Branch
`feat/wave15-content-framing-pipeline`.

## Item 1 — Case-study framing rewrite

Rule applied: every dek (the headline sub-line) and every `story.title` now leads with the
capability/action demonstrated; the honest problem/number moves into the body, never removed.
Body paragraphs, `results`, and every number are byte-for-byte unchanged. Added a new `closing`
field (`content/types.ts`) rendered as "What this means if you need something similar" —
practical takeaway for someone evaluating whether to hire GG or use the product — on all 13
case studies, wired into `components/case-study-page.tsx` (ToC + section renderer).

### Before / after — dek (headline)

| Project | Before | After |
|---|---|---|
| Warmer | "A daily semantic word game — and the embedding-model debugging story behind making it work in Hinglish." | "Diagnosed a Hinglish embedding model stuck at zero correlation, fixed the real root cause, then caught its own 'more data' fix making things worse — and shipped the LoRA model that actually worked." |
| Style Maitri | "A white-label AI shopping assistant for Indian fashion brands — and the adversarial audit that caught it lying to a bride." | "A white-label AI shopping assistant for Indian fashion brands, stress-tested by sending 6 agents to role-play skeptical shoppers on the live site — shipped only after that audit's two trust-breaking bugs were found and fixed." |
| TriageIQ | "An ML issue-triage assistant for busy open-source maintainers — and the 682-day MAE that turned out to be a data-splitting bug." | "An ML issue-triage assistant for busy open-source maintainers — caught a target-leakage bug that had inflated its own error estimate 8×, then found two more leaks nobody was looking for." |
| DealHunter | "A flight-search agent that turns a plain-English trip request into two honestly-explained trade-offs, and the two-week silent outage that taught it to watch itself." | "A flight-search agent that turns a plain-English trip request into two honestly-explained trade-offs — hardened by finding and closing a two-week silent production outage caused by two unrelated bugs hiding behind each other." |
| ShelfSense | "Demand forecasting for 30,490 retail item×store series — and the story of an evaluation harness that lied about which models actually won." | "Demand forecasting for 30,490 retail item×store series, 36% more accurate than the naive baseline — reached partly by catching an evaluation harness that had been silently flipping which models actually won." |
| ReviewIQ | "Turns customer-review text in English, Hindi, and Hinglish into structured sentiment, urgency, and authenticity signals — and the bug where a safety complaint got scored as low-priority because it was written politely." | "Turns customer-review text in English, Hindi, and Hinglish into structured sentiment, urgency, and authenticity signals — caught and fixed a safety-scoring bug using cassette-replay CI, without spending a single new API call." |
| Multimodal Fashion Recommender | "A two-tower model that recommends fashion items from how they look and what they're described as — and the representation-collapse bug that nearly sank it." | "A two-tower recommender that beats a popularity baseline 3.06× on Recall@10 — reached by diagnosing a full representation collapse down to a warmup-schedule fix, and by writing the ADR that draws an honest line on how far one shared process can scale." |
| Gold Rate Tracker | "A free-tier gold-price PWA that refused to ship an \"AI predicts prices\" feature once the honest baseline beat it." | "A free-tier gold-price PWA, benchmarked honestly enough to publish the case where the naive baseline beat the ML model — and shipped the honest forecast instead of the more exciting one." |
| AetherArt | "A Ukiyo-e style SDXL model squeezed into an 8GB consumer GPU budget — and the experiment that found the field's default quality metric can't be trusted." | "A Ukiyo-e style SDXL model squeezed into an 8GB consumer GPU budget — ran the experiment that found the field's default quality metric is structurally blind to real changes, and revised its own headline finding downward once a stricter statistical bar was applied." |
| AgentGauge | "A statistical harness that measures whether a change to an MCP server's tool descriptions actually changed agent task success — built by falsifying its own first version and keeping only what survived." | "A statistical harness that measures whether a change to an MCP server's tool descriptions actually changed agent task success — rebuilt after a predictive-validity study falsified its own first version, then audited again after catching its own scoring bug." |
| Reclaim | "A Windows disk-cleanup tool whose reclaimable-space estimate was corrected downward four times as real bugs surfaced — and whose own safety net is the only reason a fifth one didn't cost a dev environment." | "A Windows disk-cleanup tool that only ever deletes by deterministic rule, never by model score — proved its own safety net by surviving a real incident where its own delete run hit three shared Python environments, recovered every file, and rebuilt detection to be structural rather than pattern-based." |
| tracegauge | "A local, three-axis scorer for whether a Claude Code session was token-efficient or wasteful — because \"this agent is efficient\" is usually a vibe, not a measurement." | "A local, three-axis scorer that replaces \"this agent felt efficient\" with a measurement — built by testing four candidate waste heuristics against real annotator agreement, and rebuilding the architecture around the one that survived." |
| Expense Tracker | "A multi-user personal-finance app built to practice production discipline — real auth, real data isolation, real migrations, real tests — with a few pragmatic ML features layered on top." | (unchanged — already capability-first, no failure-first framing) |

### Before / after — `story.title`

| Project | Before | After |
|---|---|---|
| Warmer | "The Hinglish engine launched broken — and the fix wasn't more data" | "Zero correlation to a published, working model — the debugging trail, including the fixes that made it worse first" |
| Style Maitri | "Trusting gold-set numbers wasn't enough, so 6 agents role-played skeptical shoppers on the live site" | "6 agents went shopping as skeptics on the live site — and found what a 93.8%-accuracy eval set never could" |
| TriageIQ | "The model reported a 682-day error — and the fix was a data-splitting bug, not a better model" | "Caught a target-leakage bug that inflated error 8×, then found two more leaks nobody was looking for" |
| DealHunter | "Production was silently broken for two weeks — and two unrelated bugs were hiding behind each other" | "Found two unrelated bugs hiding behind each other after two weeks of silent production failure" |
| ShelfSense | "When your evaluation harness lies" | "Caught an evaluation harness reporting the wrong winner — four models that looked better on validation had actually gotten worse" |
| ReviewIQ | "Harm in a positive tone — and a bug found without one new API call" | "Found a safety-urgency bug — and diagnosed it using cassette-replay CI, without one new API call" |
| Multimodal Fashion Recommender | "The model collapsed to a single point — then a scaling ADR drew the line on how far one process can go" | "Diagnosed a full representation collapse to a specific warmup-schedule fix, then wrote the scaling ADR that says exactly where this architecture stops working" |
| Gold Rate Tracker | "A baseline correction flipped 'the model works' into 'the model has zero verified edge' — and shipped anyway" | "Corrected its own baseline from a 50% coin-flip to gold's real ~70% base rate — and that correction made the model's edge disappear" |
| AetherArt | "Quantization was supposed to save memory. Under CPU offload, it did the opposite." | "Expected quantization to save memory — traced why, under CPU offload, it did the opposite" |
| AgentGauge | "The −80-point effect that was actually a scoring bug" | "Caught its own reported −80-point effect as a scoring bug, corrected it to a clean null, and turned the catch into a standing audit gate" |
| Reclaim | "The tool broke its own dev environment — and it's a paragraph in this case study, not a rebuilt machine, only because the delete was reversible" | "Recovered 186 files from three shared dev environments after its own delete run hit them — then rebuilt detection so it wouldn't depend on knowing what to look for" |
| tracegauge | "The heuristic pivot: when three of four rules fail the same test" | "Tested four waste-detection heuristics against real annotator agreement — kept the one that survived, rebuilt the architecture around why the other three couldn't" |
| Expense Tracker | (no story section — short depth) | n/a |

Body paragraphs (`problem`, `approach`, `decisions`, `results`, `story.body`) and every number are
**unchanged**. `problem[]` opening sentences were audited for failure-first bleed-through
(Gold Rate Tracker, AetherArt, AgentGauge flagged by research pass) and left as-is — on reread,
each already frames the honest finding as something the project *did* ("set out to measure",
"a willingness to refuse", "ran a predictive-validity study... and it failed, so the project
rebuilt") rather than leading with the failure as a verdict; the "opening sentence" the rewrite
rule targets is the dek, which sits directly under the h1 and is the actual first thing a reader
sees.

### Self-grade: does each headline now read as competence?

Yes, with one caveat. All 12 story-bearing headlines now open with an action verb (Diagnosed /
Caught / Found / Corrected / Tested / Recovered / Expected...traced) attached to the capability
proven, with the honest number/bug folded into the same sentence rather than removed. The one
judgment call: TriageIQ and DealHunter's new headlines are close paraphrases of GG's own worked
examples in the brief, since those matched the existing story almost exactly — reused rather than
force-fit a different phrasing for its own sake. Expense Tracker's dek was already capability-led
(no rewrite needed) — flagged rather than silently left alone so it isn't mistaken for missed work.

### Verification

`npm run typecheck` / `npm run lint` / `npm run build` all clean post-rewrite; build still emits
21 static pages (unchanged route count). Full visual/E2E/axe/Lighthouse verification runs at the
end of the wave alongside item 2 (same routes touched).

---

## Item 2 — Progressive disclosure

Home and `/projects` both now cap every active filter view (including "All") to the first 4
matching cards (in `content/products.ts`'s existing AI/ML-depth order) with a "See all N →" /
"See all N in [Label] →" link — except `/projects`'s own "All" view, which stays uncapped since
it IS the see-all destination for home's "All" tease. Every category filter (on both pages) caps
regardless, since its own destination is the new `/projects/[category]` page.

- **New route `/projects/[category]`** (`app/projects/[category]/page.tsx`), one static page per
  category via `generateStaticParams`, mirroring `/work/[slug]`'s SSG pattern: server-rendered,
  uncapped, lists every project in that category, `notFound()` on an unknown id. Added to
  `app/sitemap.ts` (6 new entries); `app/robots.ts` already allows `/` blanket, no change needed.
- **Capping mechanism** (`components/project-filter.tsx`): pure CSS, zero extra client JS cost for
  the hiding itself — an inline `<style>` tag hides the specific overflow slugs
  (`[data-active-category="X"] [data-slug="Y"]{display:none}`), computed from the same `cats` prop
  the filter already receives. `ProjectCard` gained a `data-slug` attribute to make this possible.
- **No-JS safety, the one real design problem this feature raised:** the existing category filter
  is naturally no-JS-safe because a no-JS visitor's `data-active-category` can never be anything
  but `"all"`. Capping "All" itself breaks that assumption — without a fix, a no-JS visitor on
  home would see a permanent 4-card gate with no way to reach the rest (there's no JS to run the
  "See all" click... except "See all" is a plain link, so that part's fine — the actual risk was
  the CSS hide-rule itself becoming a permanent gate). Fixed with a `<noscript><style>` override
  that restores `display:flex` on every capped card whenever scripting is off — verified by a
  dedicated e2e assertion (`no-JS: every card renders, pills are inert, and no capping applies`)
  that fails if the override regresses.
- **Extracted `lib/project-display.ts`** from `project-grid.tsx` (the repo-freshness/PyPI-download
  ISR fetch + dateline formatting) so `/projects/[category]` doesn't duplicate it.
- **Counter semantics changed deliberately:** "Showing X of Y projects" now uses the *active
  view's own total* as Y (e.g. "Showing 4 of 6 projects" for a capped category), not the site-wide
  total — more informative once a view can be capped. Existing `e2e/filters.spec.ts` assertions
  updated to match; a `Math.min(categoryTotal, 4)` replaces the old exact-match expectation.

### Verification

- `npm run typecheck` / `lint` / `build`: clean. Build now emits 27 static pages (21 → 27, the 6
  new category routes).
- **Budget, measured before/after with an identical method** (curl `Accept-Encoding: gzip` against
  every eager JS chunk on `/`, isolated browser context to avoid stale-cache artifacts): baseline
  (post-item-1, pre-item-2) **167,725 B** → post-item-2 **168,283 B** — **+558 B**, comfortably
  under the 220,160 B ceiling. **Open methodology flag:** this curl-based figure doesn't reconcile
  with the previously-recorded wave-14 figure (204,782 B) — likely a compression-negotiation or
  measurement-tool difference (this session used manual `curl`, not the chrome-devtools network
  panel prior waves may have used), not a real ~37KB improvement. Flagging honestly rather than
  presenting the lower absolute number as a win; the delta (+558 B) is the reliable number here
  since both sides of it were measured the same way in the same session.
- **E2E:** full suite (59 tests) + new `e2e/category-pages.spec.ts` (10 tests) green on desktop and
  mobile projects, including the no-JS/no-cap regression guard. Rewrote `e2e/filters.spec.ts` to
  assert the new capped-count and "See all" link behavior per path (home caps "All", `/projects`
  doesn't) instead of the old shared-behavior-on-both-paths assumption.
- **Axe:** 0 violations on all 27 routes (6 new category pages added to `e2e/a11y.spec.ts`'s
  auto-discovered `ROUTES`, via a new `e2e/fixtures/category-ids.ts` mirroring the existing
  `case-study-slugs.ts` pattern).
- **Lighthouse:** home 100 a11y / 96 BP (known localhost-only `/_vercel/insights` 404, not a real
  defect) / 100 SEO. `/projects/retrieval`: 95 a11y / 96 BP / 100 SEO — investigated the a11y drop
  rather than accepted it: Lighthouse flagged `color-contrast` on the dateline span at a computed
  foreground of `#54575e`, but the actual token (`--text-lo: #9195a0`, documented 6.57:1) composited
  at ~55% opacity over the background computes to almost exactly that flagged color — reproduced
  twice, consistent both times, and matches this repo's own already-documented "axe race" pattern
  (`e2e/a11y.spec.ts`'s comment: RevealGroup's onview fade can be sampled by an automated scanner
  before it settles, worse on any route whose grid sits inside the initial viewport — true here,
  as it was for `/projects` in wave 9). Playwright's axe-core pass (with the repo's existing
  1300ms settle wait) reports 0 violations on this exact route, which is this repo's actual
  required CI gate — the Lighthouse snapshot is a supplementary manual artifact, not the gate.
  Reports: `reports/lighthouse-wave15-home-2026-07-25.json` / `-category-retrieval-2026-07-25.json`.
- **Screenshots:** `reports/screenshots/wave15/` — home teaser (desktop + 390px mobile), a capped
  category filter on `/projects`, and the `/projects/retrieval` destination page.

---

*(Sections for items 3–6 appended below as they land.)*
