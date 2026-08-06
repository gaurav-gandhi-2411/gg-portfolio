**Target user:** me (Gaurav), applying to Applied/Research Scientist roles.
**Pain point:** one static resume can't emphasize the right competencies (ranking vs. causal
inference vs. distributed training) for different JD families without manual rewriting per
application, and manual rewriting risks silently drifting from the provenance-tracked facts in
`content/provenance.md`.
**Success metric:** each variant renders as a valid ≤2-page PDF, every rendered bullet traces to
a `verified_source`, and the keyword-coverage report shows ≥60% of `jd_keywords` present in the
rendered text (measured per variant, not asserted).
**Who pays:** n/a — personal tooling, not a shipped product.

## Correction vs. the original brief

The brief assumed a `resume.js` (docx-js build script) already existed as the master content
source. It doesn't — confirmed by search across `gg-portfolio` and `ml-projects` (2026-08-01).
The actual resume build chain (per `reports/resume-rework-2026-07-17.md`) is **python-docx →
Word COM PDF export**, a manual process; the master content lives in the gitignored
`.assets/resume-sources/Gaurav_Gandhi_Resume_2026.docx`. This spec builds a **new** pipeline —
`content/resume-data.json` extracted from that docx + `content/provenance.md`, and a Node build
script using the `docx` npm package (v9.7.1, added this wave) — not a refactor of anything that
existed before. `soffice` (LibreOffice) is being installed via Chocolatey (winget is present as
an appx package but not actually invokable on this machine) to do real page-count enforcement
per the brief's hard requirement, rather than an estimate.

## content/resume-data.json schema

```
{
  id: string,                    // stable slug, e.g. "exp:indium-senior-finetune"
  section: "summary" | "experience" | "research" | "project" | "skills" | "education",
  company: string | null,        // for experience entries
  project: string | null,        // project slug, for project entries — must match content/products.ts slug
  text_runs: [{ text: string, bold: boolean }],
  tags: string[],                // competency tags, see taxonomy below
  priority: 1-5,                 // 1 = always include if section selected, 5 = cut first under page pressure
  verified_source: string,       // "repo/path:line" or "UNVERIFIED"
  surface: "live_demo" | "pypi" | "domain" | "hf_model" | "repo_only" | null,  // project entries only
  artifact_url: string | null,   // project entries only (amendment 4) — required (http/https) whenever
                                  // surface != "repo_only"; the verified link the surface claim is
                                  // backed by (live_demo/domain -> liveUrl, hf_model -> the HF Space
                                  // URL, pypi -> the canonical https://pypi.org/project/<name>/ page).
                                  // null when surface == "repo_only". Enforced by lintArtifactUrl.
  research_status: "under_submission" | "in_preparation" | "published" | null, // research entries only
  // project entries only (amendment 2, 2026-08-01):
  demo_quality: 1-5,      // how well the live surface lands in 15s for a cold visitor
  role_relevance: 1-5,    // fit to applied-scientist screening at large tech companies
  technical_depth: 1-5,   // modelling/statistical substance
  metric_strength: 1-5,   // how strong and verifiable the headline number is
  headline_metric: string // short (no parens — see "More on GitHub" below), used only in the collapsed line
}
```

Tag taxonomy (fixed set, matches the brief): `ranking`, `contrastive-learning`,
`causal-inference`, `calibration`, `forecasting`, `rag`, `agents`, `distributed-training`,
`leadership`, `experimentation`, `multilingual-nlp`, `diffusion`, `mlops`. A bullet can carry
zero, one, or several.

**Surface determination rule:** read from `content/products.ts` (canonical) — `liveUrl` present
→ `live_demo` (or `hf_model` if the `liveUrl` host is `huggingface.co`); no `liveUrl` but a
`pypi` field → `pypi`; neither, only `repoUrl` → `repo_only`. No project in the current
portfolio has a purchased custom domain, so `domain` is defined but unused today — verified by
checking every product's `liveUrl` host against known free subdomains (`vercel.app`,
`github.io`, `run.app`, `huggingface.co`); flag if that ever changes.

**This rule has no code implementation — it's applied by hand when `resume-data.json` is
authored/updated**, so a `surface` value is only as fresh as the last time someone re-checked it
against `products.ts` and the real world. **Amendment 4 (2026-08-05) incident:** AgentGauge was
published to PyPI (`agentgauge-harness` v0.5.2, 2026-07-30) but `products.ts`'s entry for it was
never given a `pypi` field, so the (correctly-applied, at the time) rule kept classifying it
`repo_only` for 6 days after publication. Fixed by adding the missing `pypi` field to
`products.ts` and correcting `resume-data.json`'s `surface` + new `artifact_url`. The
`lintArtifactUrl` gate (added the same amendment) doesn't re-derive `surface` automatically — it
only catches a `surface` claim that has no backing link at all, which is a narrower, cheaper
check than full re-derivation but would not, by itself, have caught this specific incident (the
old data had no `artifact_url` field yet, so the gate didn't exist to catch it). Re-deriving
`surface` from `products.ts`/PyPI automatically at build time, rather than by hand, was
considered and explicitly deferred — out of scope for a personal tooling project at this size;
noted here so a future session doesn't rediscover the same gap from scratch.

## content/certifications.json schema

```
{
  name: string, issuer: string,
  status: "held" | "in_progress", expected: "YYYY-MM" | null,
  kind: "certification" | "course" | "self_paced",  // amendment 2
  description: string | null  // required for kind == "self_paced"; null otherwise
}
```

Source: `.assets/resume-sources/canonical-resume.pdf` CERTIFICATIONS line (verbatim, per
`provenance.md`'s "career facts come only from the canonical PDF" rule). All 4 certs currently
listed with no in-progress qualifier in that source → all `status: "held"`, `expected: null`.
`kind`: `certification` = a formal, proctored, industry-recognized exam (Google Cloud
Professional Data Engineer); `course` = a MOOC/specialization with a completion certificate, not
a proctored exam (the 3 DeepLearning.AI specializations); `self_paced` = independent,
non-course-based learning/build with no certificate to name — none currently exist. Rendered
section heading: **"Certifications & Continuing Education"** (renamed from "CERTIFICATIONS",
amendment 2). `certification`/`course` entries render terse, "·"-joined, using the existing
held/in-progress logic; `self_paced` entries render as their own bullet — name + `description`,
never "held"/"in progress" framing (enforced by `lintCertificationKind`).

## variants/<name>.json schema (as specced)

```
{
  target_role, jd_keywords: string[], max_pages: 2, boost_tags: string[], drop_ids: string[],
  stage1_weights: { demo_quality?, role_relevance?, technical_depth?, metric_strength? }, // optional, amendment 3
  stage2_weights: { demo_quality?, role_relevance?, technical_depth?, metric_strength? }, // optional, amendment 3
  stage1_cutoff: number, // optional, amendment 3, default 2
  max_full_entries: number // optional, amendment 5, default 8
}
```

`score_weights` (amendment 2's single-vector override field) is retired — superseded by
`stage1_weights`/`stage2_weights` below. No shipped variant ever used it.

## Selection algorithm

**Projects (amendment 3, 2026-08-05 — replaces amendment 2's single linear weight vector):**
a single linear combination of the 4 intrinsic scores produced two real rank-position inversions
against the intended ordering (see amendment 2's log in PLAN.md) — `demo_quality` only drives
click-through for the first couple of entries a recruiter actually opens; below that, substance
should dominate. One linear vector can't express a value curve that bends partway through the
list, so ordering is now a **two-stage positional model**, run only over the surface-gated
eligible pool (repo_only projects are excluded before either stage — unchanged from amendment 1):

1. **Stage 1** scores every eligible project with demo-dominant weights
   (`{ demo_quality: 0.45, role_relevance: 0.25, technical_depth: 0.20, metric_strength: 0.10 }`)
   and takes the top `stage1_cutoff` (default 2) to fill ranks `1..cutoff`.
2. **Stage 2** scores everything *not* selected in stage 1 with substance-dominant weights
   (`{ demo_quality: 0.10, role_relevance: 0.35, technical_depth: 0.35, metric_strength: 0.20 }`)
   and fills the remaining ranks in that order.

`weighted_score` per stage is the same linear form as amendment 2
(`demo_quality×w.demo + role_relevance×w.role + technical_depth×w.depth + metric_strength×w.metric`),
just with two different weight vectors applied at two different points in the list. A variant may
override either vector (`stage1_weights`/`stage2_weights`, partial overrides merge with that
stage's defaults) and/or `stage1_cutoff`.

**Tie-break** (deterministic, no random/insertion-order fallback), applied within a stage when two
scores are equal: `demo_quality` desc → `metric_strength` desc → project `id` asc. Score equality
is checked with a `1e-9` epsilon, not `===` — floating-point sums of 1-5 integers times 2-decimal
weights can differ in their last bit even when mathematically identical (found during amendment 3
verification: Reclaim and Expense Tracker's stage-2 scores are both exactly 2.55 by hand, but
compute to `2.5499999999999998` vs `2.5500000000000003` — a bare `!==` check silently skipped the
tie-break and let float rounding noise, not the spec'd rule, decide the order).

The build script prints **both** stage tables (id, score, per-axis breakdown) plus the combined
final order to stdout on every run — the auditability requirement carried forward from amendment
2, item 2, extended to both stages. `jd_keywords`/`boost_tags` still don't affect project
ordering; they still drive the keyword-coverage report and research-entry ordering (unchanged,
see below).

**AgentGauge structural-limit note (amendment 3) — resolved in amendment 4, kept here for
history:** amendment 3 found the two-stage model couldn't place AgentGauge as a full entry
because its `surface` was `repo_only`, and diagnosed this as a hard-gate conflict rather than a
weighting problem — correctly, as it turned out. Amendment 4 verified AgentGauge is actually
published to PyPI (`agentgauge-harness` v0.5.2) and `content/products.ts` was simply missing its
`pypi` field; once corrected (`surface: "pypi"`), AgentGauge entered the ranked pool and won
stage 2 outright. No ranker change was needed, confirming amendment 3's diagnosis.

**Full entry cap (amendment 5, 2026-08-05):** independent of the ranker's sequence — the two-stage
model still produces the same full best-first order it always did. Before the page-fit loop
(below) even starts, only the top `max_full_entries` (default 8, per-variant override) of that
order render as full entries; everything ranked below the cap collapses into "More on GitHub"
alongside the `repo_only` force-collapses. The 2-page gate still applies on top of the capped set
— if the capped 8 still overflow, the page-fit loop trims further exactly as before. Every
collapse — by `repo_only` gate, by the cap, or by page-fit overflow — is recorded with its own
distinct reason and printed to stdout and the coverage report; nothing is ever silently dropped.

**Research:** unchanged from the original design — scored by tag-overlap with `boost_tags` +
keyword hits (`|tags ∩ boost_tags| × 2 + keyword hits`), since amendment 2 only added the 4
intrinsic scores to *project* records, not research records (there is currently only 1 research
entry).

1. Always include: `summary` (post-lint), all `experience` entries at `priority` 1-2, `education`,
   all `skills`.
2. Apply the surface hard-gate (see below) before scoring — `repo_only` projects never enter the
   ranked pool, they go straight to forced-collapse.
3. Drop any id in `drop_ids` unconditionally, before scoring.
4. Take the top `max_full_entries` (default 8) of the ranked order as full-entry candidates;
   everything below the cap collapses immediately (amendment 5). Render those candidates and
   research (by tag-overlap) until either (a) everything fits, or (b) the page-count check fails
   — then drop the **lowest-scored project** first (research only drops once no projects remain
   to drop), and re-render, repeating until it fits or nothing is left to drop (hard build
   failure).
5. Every collapsed project (by `surface == "repo_only"`, by the `max_full_entries` cap, or by
   page-cut) appears in the "More on GitHub:" line — see the cap rules below. Collapsed research
   entries have no equivalent — they just drop silently (single-entry pool today, so this is a
   narrow, documented gap, not a simplification worth generalizing yet).

**"More on GitHub" line (amendment 2, item 5):** built from the collapsed project entries,
sorted by the same `weighted_score`; the single highest-scoring collapsed entry (if it has a
`headline_metric`) gets `Name (metric)`, every other entry is name-only. Hard cap: the full line
(including the "More on GitHub: " prefix and trailing period) must be ≤200 chars, and must carry
a metric — i.e. a "(" — for at most one project. **`headline_metric` values must never contain a
literal paren** (`lintHeadlineMetricNoParens` catches this at the content level — the collapsed
line always wraps the metric in its own parens, so an embedded paren breaks the
one-metric-equals-one-open-paren invariant the length/count check relies on; caught and fixed
during this build, see PLAN.md's discrepancy log).

## Hard gates (build fails, non-zero exit)

- A project with `surface == "repo_only"` rendered as a full entry (not collapsed into "More on
  GitHub:").
- Page count (via `soffice --headless --convert-to pdf`, counted with `pypdf`) exceeds
  `max_pages`.
- Any bullet with `verified_source == "UNVERIFIED"` included in the render, unless
  `--allow-unverified` is passed.
- Summary contains a project/product/publication count or a superlative from the banned list
  (`13 products`, `11 live`, `authored two preprints`, `award-winning`, `world-class`, plus any
  bare integer immediately followed by `products`, `projects`, `papers`, `preprints`, or
  `publications`).
- A certification rendered with `status != "held"` and no `expected` set.
- A `self_paced` certification with no `description`, or whose `name` uses certificate language
  (`specialization`/`certification`/`certificate`/`course`).
- A research entry's `research_status` re-labeled to anything other than its literal value.
- The "More on GitHub" line exceeds 200 chars, or carries a metric for more than one project.
- Any project's `headline_metric` contains a literal paren (content-level root-cause check for
  the line-length gate above).

## Keyword coverage report

Per variant: for each `jd_keywords[i]`, case-insensitive substring match against the full
rendered text (all sections). Output `{ keyword, present: bool }[]`, plus a summary line
`N/total keywords present`.
