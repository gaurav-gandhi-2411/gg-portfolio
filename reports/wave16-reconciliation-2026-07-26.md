# Wave 16 item 1 — content reconciliation (2026-07-26)

Branch `feat/wave16-reconciliation-chatbot`. Reconciles `content/products.ts`,
`content/case-studies/reviewiq.ts`, and `content/provenance.md` against ground truth already
verified this wave via `gh`/`WebFetch` against the real source repos — this report does not
re-verify, only applies and documents the two fixes found, and reconciles the remaining 11
tracked projects for completeness.

## Premises corrected

The task brief handed into this wave carried two premises that were checked against the real
source repos and found **false**:

1. **"Samidha Reviews has its own custom domain."** Not true — `review-iq`'s `homepageUrl` field
   is empty and there is no CNAME file anywhere in the repo. The only live surface is the
   existing Cloud Run `liveUrl` (`.../docs`), unchanged. No domain claim is made anywhere in
   this wave's fix.
2. **"multimodal-fashion-recommender has a live Vercel web app."** Not true — the project's
   `homepageUrl` is empty, there is no `vercel.json` anywhere in the repo, and a code search for
   "vercel" across the repo returns zero hits. The only live surface is the existing Hugging Face
   Space. An unlisted Cloud Run *staging* API was found during verification but is deliberately
   **not** added to the portfolio (see row below).

Both premises are reconciled to verified reality in the table below, not asserted as given.

## Reconciliation table (all 13 tracked projects)

| Project | Site said (before this wave) | Verified reality | Fix applied / no-fix-needed reason |
|---|---|---|---|
| triageiq | Repo public, live at `triage-iq-orcin.vercel.app`, README name "TriageIQ" | Confirmed accurate — repo public, not archived, live URL 200, README name matches | No fix needed |
| warmer | No repo link (repo intentionally private, documented in `provenance.md`) | Confirmed unchanged — repo still private by design | No fix needed, no drift |
| multimodal-fashion-recommender | Live entry point is the HF Space only, no Vercel app | Confirmed: HF Space only. Empty `homepageUrl`, no `vercel.json`, zero "vercel" code-search hits. An unlisted Cloud Run **staging** API (`fashion-recommender-staging-...a.run.app/docs`) exists but is a staging hostname, not a polished public surface | No fix — staging API deliberately **not** published without GG's explicit confirmation; documented here as a known-but-intentionally-unlinked finding |
| style-maitri | Repo `agentic-shopping-assistant`, live at `stylemaitri.vercel.app` | Confirmed accurate | No fix needed |
| shelfsense | Portfolio name "ShelfSense", repo-only (no live deploy) | Repo README says "ShelfSense-M5"; portfolio's shorter "ShelfSense" is cosmetic, consistent with the site's existing convention of shorter marketing names (same pattern as Warmer/Style Maitri/DealHunter below) | No fix needed |
| aetherart | Repo public, live Cloud Run demo, README name "AetherArt" | Confirmed accurate | No fix needed |
| agentgauge | Repo public, no live URL (research artifact) | Confirmed accurate | No fix needed |
| reclaim | Repo public, live surface = GitHub Releases page | Confirmed accurate — Releases page is the correct live surface for a downloadable installer | No fix needed |
| **reviewiq** | Name: "ReviewIQ" | Live-branded "Samidha Reviews" in production: Swagger UI title reads "Samidha Reviews API - Swagger UI"; `.env.example` sets `RESEND_FROM_NAME=Samidha Reviews`. Repo name/slug/metadata unchanged. **No** custom domain exists. v1 HF demo still live per README ("v1 remains live for demo purposes") — nothing retired | **Fix applied:** renamed to "Samidha Reviews" in `products.ts` and the case-study `title`; existing `liveUrl` kept as-is; no domain or demo-retirement claim added |
| gold-rate-tracker | Repo public, live GitHub Pages PWA | Confirmed accurate | No fix needed |
| dealhunter | Portfolio name "DealHunter", repo `agentic-travel-booking-system`, README uses "DealHunter" branding | Repo public/not archived, README branding matches, but the *live deployed site's* own `<title>`/hero copy still say "Agentic Travel Booking System" — not re-skinned to match the README's branding | No fix needed — same pre-existing intentional pattern as Warmer/Style Maitri (portfolio product name diverges from repo/live-site technical name); documented as intentional, not a bug |
| tracegauge | PyPI package `tracegauge`, no live web URL | Confirmed accurate — PyPI listing is the correct live surface | No fix needed |
| **expense-tracker** | No `liveUrl` (demo documented as down, citing `provenance.md#expense-tracker:state`) | A working Supabase-backed deployment exists at `https://expense-tracker-tawny-eight-98.vercel.app` — confirmed HTTP 200, live login page, matches the repo's own registered `homepageUrl`. Wave 15's report had cited a **different, dead** URL (`https://expense-tracker-eight-xi-93.vercel.app`, 404) | **Fix applied:** added the correct `liveUrl`; replaced the stale "found down on 2026-07-18" comment (which described the wrong URL's outage) with a note citing this wave's verification and naming the dead URL that was previously (incorrectly) cited |

## Files changed

- `content/products.ts` — `reviewiq` entry renamed to "Samidha Reviews"; `expense-tracker` entry
  gained a `liveUrl` and its stale comment was rewritten.
- `content/case-studies/reviewiq.ts` — `title` field and one prose sentence in `problem` updated
  to "Samidha Reviews"; repo-path/technical references (GitHub URL, live API docs link, source
  comment citing the `review-iq` repo) intentionally left as `review-iq`/`ReviewIQ` where they
  name the repo/file, not the product.
- `content/case-studies/index.ts` — checked, no change needed (keys by import/slug, never by
  product display name).
- `content/provenance.md` — new "Wave 16 (2026-07-26)" section appended documenting both fixes
  with citations, per the file's existing citation-table + prose-correction convention.

## Verification

- `git diff --stat` and `npx tsc --noEmit` results are in the wave's session report/PR body
  (this report covers the reconciliation table and premise corrections; type-checking is
  procedural, not a content-provenance claim).
