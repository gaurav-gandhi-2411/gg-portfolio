# Wave 16 — State Reconciliation, Identity-Drift Detection, Portfolio Chatbot

GG's brief: reconcile 13-project state to ground truth (three rebrands had gone unnoticed);
extend the weekly Action to detect identity drift, not just metrics drift; build a RAG chatbot
over GG's own case-study corpus as a flagship applied-AI demo, with a published eval; four
think-ahead improvements. Branch `feat/wave16-reconciliation-chatbot`, off `main` post wave-15
merge (`24a258d`).

## Premises corrected before building anything

The brief asserted two facts about review-iq/"Samidha Reviews" and multimodal-fashion-recommender
that didn't hold up under verification against the real source repos (`gh`/WebFetch, not the
portfolio's cached claims):

- **"Samidha has its own domain"** — false at verification time. The rebrand itself is real and
  live (Swagger UI title, static docs pages, `.env.example`), but no custom domain existed
  (`homepageUrl` empty, no CNAME). **Update mid-wave**: GG confirmed he'd separately bought
  `samidhareviews.xyz` and has a Cloudflare Pages demo at `review-iq-demo.pages.dev` — handled as
  a fully separate task against the `review-iq` repo (see "Separate task" below), not folded into
  this reconciliation, per GG's explicit instruction not to disrupt this workflow.
- **"multimodal-fashion-recommender has a live Vercel web app"** — no evidence anywhere (empty
  homepage field, no `vercel.json`, zero "vercel" code-search hits). HF Space only, plus an
  unlisted Cloud Run *staging* API deliberately not linked (not a polished public surface, not my
  call to publish without GG's confirmation).

Full 13-row reconciliation table: `reports/wave16-reconciliation-2026-07-26.md`.

## Items shipped (all code-complete on this branch)

- [x] **Item 1 — reconciliation**: `reviewiq` renamed to "Samidha Reviews" in `products.ts` +
      case study (verified live rebrand, no domain/demo-retirement claim added since neither
      checked out). `expense-tracker` given its actual working `liveUrl`
      (`expense-tracker-tawny-eight-98.vercel.app`, verified 200) — wave 15's report had cited a
      different, dead URL. `dealhunter`/`shelfsense` name gaps documented as pre-existing,
      intentional portfolio-vs-repo-name divergence (same pattern as Warmer/Style Maitri), not
      "fixed." Provenance note appended citing both corrections.
- [x] **Item 2 — identity-drift detection**: new `scripts/identity-drift.mjs` (README name, repo
      visibility/archived, live/demo/PyPI/HF status) diffed against a new machine-owned
      `content/identity-state.json`, wired as a third job in `metrics-refresh.yml` following the
      existing diff-gated-PR pattern exactly. Rename detection compares against the *previous
      run's* value, not a one-shot README-vs-`products.ts` compare — several products have
      permanently-intentional cosmetic name gaps that would otherwise reopen a "renamed" issue
      every week. A name-mismatch additionally opens/updates a per-repo GitHub issue so it isn't
      lost in an unmerged PR. Archived-state transitions are flagged (unlike the existing
      new-repo-discovery logic, which suppresses archived repos as noise).
- [x] **Item 3 — portfolio chatbot** (`/ask`): build-time corpus indexing (400 chunks from case
      studies, provenance.md, experience, product taglines, availability, site identity; local
      ONNX embeddings via `@huggingface/transformers`, not a hosted API — Ollama can't serve
      Vercel's production runtime, so a bundled model keeps corpus + query embeddings in the same
      vector space with zero external dependency at request time) → hybrid retrieval (dense
      cosine + IDF-weighted lexical, 0.7/0.3) with a similarity-threshold refusal gate that
      doubles as the honest-refusal mechanism and the primary off-topic/injection filter → Groq
      JSON-mode generation, every citation validated server-side against the actual retrieved
      chunk set before it reaches the client → a dedicated `/ask` page (not a widget) with a
      corner launcher, suggested questions, loading/empty/error states → a 30-case eval harness
      (12 project-factual across 12 of 13 projects, 5 background, 3 availability, 5 unanswerable,
      5 adversarial/injection) with cassette-replay CI and a `--live` recording mode.
- [x] **Item 4 — think-ahead**: structured `content/availability.ts` (dedupes two hand-typed
      copies of the same sentence, now also a chatbot-citable chunk); related-projects section on
      case-study pages (free from existing category tags, capped at 3); printable case-study view
      (`@media print`, no PDF library); a "Currently building" signal on the hero, driven by real
      GitHub push activity, not a manually-maintained strip.
  - **Rejected** (reported, not built): a Calendly/booking embed (new third-party dependency, no
    stated ROI), a persistent analytics dashboard (Vercel Analytics already covers this),
    multi-language support (no stated need), a newsletter signup (out of scope for a portfolio
    site).

## Verification

- `npm run lint` / `npx tsc --noEmit` / `npm run build`: clean throughout, after every commit.
- Full Playwright suite (`npx playwright test`): **131 passed, 1 failed** — the 1 failure is a
  **pre-existing bug on `main`**, confirmed via a clean `git worktree` check before touching
  anything: `app/globals.css`'s `:has(article:hover)` sibling-recede rule dims non-hovered
  `/projects` cards to `opacity: 0.55`, which drops text contrast below WCAG AA for real mouse
  hover, not just a test artifact. I attempted a fix (raising the opacity), found a second,
  harder-to-explain compounding contrast failure on one specific card that didn't respond the way
  a simple linear model predicted (possibly a hover-transition timing interaction with axe's
  scan), and reverted rather than ship a partially-understood tweak to a file outside this wave's
  approved scope. **Flagging for a follow-up wave**, not fixed here — root-cause hypothesis and
  revert are both in the `test(chatbot): eval harness...` commit message.
- `e2e/ask.spec.ts` (new, 6 cases) + `/ask` added to `a11y.spec.ts`: all pass.
- Lighthouse (`reports/lighthouse-wave16-{home,ask}-2026-07-26.report.*`): home
  performance 0.91 / a11y 1.00 / best-practices 0.96 / seo 1.00, 412 KiB; `/ask`
  0.92 / 1.00 / 0.96 / 1.00, 392 KiB — confirms the chatbot doesn't blow the home page's budget
  (separate route, code-split by default; only the corner launcher ships everywhere else).
- Chatbot eval dry run (`reports/wave16-chatbot-eval-2026-07-26.{md,json}`): **no `GROQ_API_KEY`
  available in this environment** — 23/30 fixtures report "no cassette recorded" (expected); the
  other 7 (5 adversarial + 2 unanswerable) resolve at the retrieval gate alone, which is real,
  measured behavior. **A live baseline run is still pending** — see "Not yet done" below.
  `content/chatbot-eval-summary.ts` on the `/ask` page currently shows placeholder/"pending" copy,
  not fabricated numbers.

## Not yet done — needs GG

1. **Live eval baseline.** `node evals/chatbot/run-eval.mjs --live` needs a real `GROQ_API_KEY`
   locally (not in this environment — GitHub's Action secret isn't exposed to local sessions).
   Once run: review the recorded cassettes, update `content/chatbot-eval-summary.ts` with real
   numbers, and add numeric thresholds to `.github/workflows/eval.yml` (deliberately absent right
   now — no fabricating a threshold against zero real data).
2. **`GROQ_API_KEY` as a Vercel production env var** for `/api/chat` to work once deployed — a
   live serving-config change, on the standing escalation list, not done autonomously:
   `vercel env add GROQ_API_KEY production`.
3. **The pre-existing `/projects` hover-contrast bug** described above — a real WCAG AA failure
   independent of this wave, needs its own investigation (the compounding case didn't fit a
   simple opacity-value fix).

## Separate task, not part of this branch: samidhareviews.xyz

Mid-wave, GG asked (as an explicitly separate task, against the `review-iq` repo) to get
`samidhareviews.xyz` live. Findings: the rebrand/demo were already merged to `review-iq`'s `main`;
some unrelated in-flight WIP in that repo was found and correctly left untouched; DNS is
registered but still on Namecheap's default nameservers (nothing at the apex — `api.`/`app.`
subdomains are already correctly wired directly in Namecheap DNS); added `samidhareviews.xyz` as a
custom domain on the Cloudflare Pages project (pending zone activation — blocked on a permission
scope the current token doesn't have, and on Namecheap dashboard access I don't have). Full
findings/remaining manual steps were reported to GG directly in the conversation, not duplicated
here since it's a different repo's concern.

## Merge-gate self-assessment (rule 70a)

- Branch is CC-created (`feat/`) ✅. Diff is large (11 commits, well over ~400 reviewable lines)
  → **draft PR required regardless**, matches the task's explicit ask. Touches CI config
  (workflows) but not auth/money/PII/schema/deploy secrets. Touches UI paths (`app/ask`,
  `components/chatbot/`, `components/case-study-page.tsx`) — screenshots captured via a direct
  Playwright script (chrome-devtools MCP disconnected mid-session) in
  `reports/screenshots/wave16/`: the home page with the corner launcher and new "Currently
  building" line, `/ask`'s empty state with suggested questions, the fail-soft honest-refusal
  bubble (no `GROQ_API_KEY` locally), and a Warmer case study showing the related-projects rail
  and print button. **Opened as DRAFT**, human merges, per both the gate and the explicit
  instruction.
