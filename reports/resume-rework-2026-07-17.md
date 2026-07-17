# Resume rework — 2026-07-17 (wave 10, item 6)

Full rework of GG's resume targeting Senior/Principal Applied AI Scientist roles (40+ LPA,
India). Two pages. Deliverables:

- `.assets/resume-sources/Gaurav_Gandhi_Resume_2026.docx` — editable master (gitignored, like
  all raw resume sources)
- `.assets/resume-sources/Gaurav_Gandhi_Resume_2026.pdf` — exported via Word (gitignored)
- `public/resume.pdf` — **replaced** with the new PDF (MD5 `f37fc945…`), so the site's
  "Resume" link serves the new version on merge. The canonical 2026-06-12 source PDF is
  untouched.

Build chain: python-docx → Word COM PDF export (the brief's `/mnt/skills/public/docx` skill
path doesn't exist on this machine — no bundled docx skill; python-docx + Word achieves the
same ATS-clean output). ATS posture: single column, no tables/text boxes/images for content,
standard headings, real text throughout, hyperlinks preserved.

## Sources of truth (as briefed)

- **Career facts** — ONLY `.assets/resume-sources/canonical-resume.pdf` (MD5 `6aec7861…`,
  GG's own file). Companies, clients, titles, dates, locations, education, GPAs,
  certifications, phone, email are copied verbatim. Nothing reconstructed.
- **Project metrics** — `content/provenance.md`'s file:line-sourced entries (independently
  verified against the repos in earlier waves). No number appears that isn't in one of those
  two sources.

## Structural changes vs. the old resume

| Area | Old | New |
|---|---|---|
| Length/balance | 2 pages, p2 ~60% used | 2 pages, both full: p1 = summary + experience + research, p2 = projects + skills + education |
| Header | LinkedIn, GitHub | + Portfolio (gaurav-gandhi.vercel.app); arXiv slot deferred until ID lands |
| Summary | Dense third-person-ish capability list | 5 lines, first-person, matches the portfolio voice GG approved in wave 10 ("I build AI systems and see them through…"); leads with the team + $10M transformer work; closes on the honest-evaluation stance |
| Experience | Kept structure | Same facts, tightened wording; every bullet stays action → what → measured result |
| Research | Not present | New section: the paper (first-author, arXiv pending) + AgentGauge as the benchmark behind it |
| Projects | 6 projects, some stale/unverifiable numbers | 6 full entries + one "Also:" line covering 3 more — every metric provenance-backed, Warmer added (it was missing entirely), each with live/repo links |
| Skills | 6 groups | Regrouped; new **Evaluation & LLM Observability** group first-class (LLM-as-judge, CI-gated evals, contamination audits) — the principal-panel differentiator; added MCP, Vercel/Firebase (all real usage) |
| Voice | "Senior Data Scientist with 5 years building…" | Warm-professional first person throughout, per GG's wave-10 direction |

Positioning note: the header title stays **"Senior Data Scientist — Applied AI"** — the real
employed title first, positioning second. The portfolio's "Senior Applied AI Scientist" brand
is in the subtitle phrasing, not presented as a job title GG hasn't held.

## Every quantified claim and its source

**From the canonical resume (employer/education facts, verbatim):** 5-person team · 97%+
field-level accuracy · 9 rejection reasons / 55 document types · hours→seconds copilot ·
50M+ documents · 144 A100 GPUs · 95%+ field accuracy · $10M+ annual savings · 27% engagement
lift · ~20% inefficiency reduction · all dates/titles/GPAs/certifications · phone
+91-8789321250 · email gauravgandhi429@gmail.com.

**From provenance.md (projects/research):**

| Claim on resume | Provenance ID |
|---|---|
| Warmer Hinglish Spearman −0.003 → 0.639 | `warmer:hinglish-fix` |
| Style Maitri ~52K items / 8 stores | `style-maitri:catalogue-size` |
| Style Maitri intent accuracy 93.8% (n=211) | `style-maitri:intent-accuracy` |
| TriageIQ top-3 82.5% (k8s) / 90.4% (vscode) | `triageiq:classifier-top3` |
| TriageIQ contamination guard + 1.9–9.1% fabrication rate | `triageiq:contamination-adr0018` (+ ADR-0028 rates quoted in that section) |
| DealHunter 597 tests, ≥87.65% coverage | `dealhunter:test-coverage` |
| MMFR Recall@10 3.06× (0.0328 vs 0.0107) | `mmfr:recall10` |
| AetherArt 6.2GB peak VRAM / 8GB budget | `aetherart:vram` |
| ReviewIQ 83.8% CI-gated eval | `reviewiq:extraction-eval` |
| Gold Rate Tracker "baseline honestly beat the model" | `gold-rate-tracker:headline` |
| AgentGauge 8 dimensions / 10-server pilot | `agentgauge:scoring-dimensions` |
| "nine live AI products" | `derived:products-live-count` |

## Dropped from the old resume (couldn't verify — flag for GG)

1. **"100k+ item catalogue"** (old Agentic Fashion Shopping Assistant bullet). The repo's
   dated reports say 52,494 current (61,883 historical max) — `style-maitri:catalogue-size`.
   The new resume says ~52K. If 100k+ referred to something real (e.g., pre-dedup raw scrape),
   tell me the source and it can return.
2. **TriageIQ "~77% coverage" prediction-interval claim** — no source found in the repo's
   current eval artifacts; replaced with the verified classifier metric.
3. **AetherArt "360-run CLIP-score sweep"** — plausible but not in provenance.md; replaced
   with the verified VRAM framing (the repo's own preferred hero metric since its 2026-06-07
   README rewrite).
4. **DealHunter "judged coherence" phrasing** — kept the LLM-as-judge harness (verified), but
   the old "24/24 completion, coherence 4.625" numbers were for a removed demo profile
   (documented in provenance.md's DealHunter correction) and stay off.

## GG should verify

- **Phone number** +91-8789321250 — carried verbatim from your resume; confirm it's current.
- The **summary's claims about scope** ("lead and mentor a 5-person team… Uber's AI org (via
  Indium)") — phrasing follows your resume's own framing; confirm you're comfortable with
  "via Indium" appearing in the summary (it keeps the client relationship honest up front).
- **Certifications line** — carried as-is; drop any you'd rather not carry.
- Old resume's "TriageIQ" was spelled "TriageIQ" in one spot and "TriagelQ"-like rendering in
  another (PDF extraction artifact); new resume uses "TriageIQ" consistently.

## Not done / deferred

- arXiv link in the header — deferred until the ID exists (same policy as the site).
- The portfolio's `content/experience.ts` still carries the old resume's bullet wording
  (verbatim-from-resume by design). The site and resume now phrase the same facts slightly
  differently — both faithful, but if GG wants word-level parity, that's a follow-up content
  pass.
