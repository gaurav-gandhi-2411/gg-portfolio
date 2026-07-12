# spec.md — GG Portfolio Site (`gg-portfolio`)

## Objective
A recruiter- and hiring-manager-facing portfolio at a Vercel domain (working name `gauravgandhi.vercel.app`; custom domain later) that positions Gaurav Gandhi as a **Senior/Principal Applied AI Scientist who ships production AI products and independent research**. Primary conversion: resume download + contact. Secondary: clickable live demos and the arXiv paper.

Reference for structure (not visual style): maninder.vercel.app — hero → about → experience → selected work → writing/research → contact. We differentiate on **live products and measured impact**, not articles.

## Non-goals (v1)
- No blog/CMS, no dark-mode toggle ceremony (pick one excellent theme), no animation-heavy scroll effects, no case-study subpages (link to repos/READMEs instead — they're already production-quality per rule 71).

## Stack
Next.js (App Router, static export where possible) + Tailwind + shadcn/ui on Vercel. Content as typed data files (`content/*.ts`), not hardcoded JSX — one source of truth per section. Lucide icons. No CMS, no DB.

## Visual identity (rule: identity FIRST, before pages)
- New, distinct identity — do not reuse Warmer/StyleMaitri/TriageIQ branding.
- Deliver: logo/monogram ("GG"), favicon, OG image (1200×630), design tokens file (colors, type scale, spacing, radii) per rule 15b.
- Direction: senior-IC gravitas — restrained palette, strong typography, generous whitespace. Read /mnt-equivalent frontend-design guidance in the repo's aesthetic wave. No template-y gradients.

## Information architecture
1. **Hero**: name, one-line value prop ("I build production AI systems and the research behind them" — refine in copy pass), status badge (Open to Senior AI/ML roles), CTAs: Resume (PDF) · GitHub · LinkedIn · arXiv/Scholar (when live). 2–3 headline stats with honest numbers (e.g., "50M+ docs processed by systems I built", "$10M+ measured savings", "N live products") — every stat must trace to the content manifest; no invented numbers.
2. **About**: 2 short paragraphs — production AI at Indium/Uber scale + independent research/products under own name. Skill chips (curated ~10, not a tag cloud).
3. **Experience**: Indium (Client: Uber) Senior DS — multi-agent NL2SQL copilot; document-understanding encoder-decoder (50M+ docs, 144 A100s, $10M+ savings); LoRA fine-tuning platform; session-aware recommender (27% engagement lift); ViT document quality gate. Prior roles from resume. Tech chips per role.
4. **Products (flagship section — this is the differentiator)**: cards with live-link + repo + one measured metric each:
   - **Warmer** — daily semantic word game (playwarmer.vercel.app); Hinglish embedding eval story (Spearman −0.003 → 0.639).
   - **StyleMaitri** — Indian occasion styling, 52–68K cross-store items (stylemaitri.vercel.app).
   - **TriageIQ** — support-triage ML pipeline; fabrication-gated CI (3.1% measured, hard gate).
   - **DealHunter, ShelfSense (36% WRMSSE ↓ vs baseline), ReviewIQ, Multimodal Fashion Recommender (3.06× Recall@10), gold-rate-tracker, AetherArt** — secondary grid, smaller cards.
   - **tracegauge** — PyPI badge + install one-liner.
5. **Research**: AgentGauge paper "Tool-Description Quality Is Not One Axis" — abstract 2-liner, links: arXiv (placeholder until ID assigned; feature-flag so section ships hidden or "preprint" until live), repo. Slot for Tier 2 paper as "in progress".
6. **Contact/footer**: email CTA, location (Bengaluru · remote-friendly), social row. No contact form (spam magnet, adds backend for nothing).

## Content pipeline (the real risk — code is easy, claims are not)
- Wave 1 builds a **content manifest**: for every metric/claim above, record source (repo README @ SHA, resume, or "GG-provided") in `content/provenance.md`. Any claim without a source ships as omitted, not softened. Rule 65b applies to marketing copy.
- Flag to GG a short list of missing inputs: resume PDF (final), preferred email, LinkedIn URL, headshot (optional), any Uber-metric that can't be public (client confidentiality check — GG decides, default to publishing only what's already in his resume).

## Quality gates (same discipline as every other repo)
- CI: lint + typecheck + build (required checks), branch protection, auto-merge per 70a. Pre-commit per rule 25.
- Budgets (rule 15e): initial JS ≤ 150 KB, LCP ≤ 1.5 s, CLS ≤ 0.05 — measure with Lighthouse post-deploy, commit baseline to `reports/`.
- A11y: axe smoke on the single page; keyboard-navigable; semantic landmarks.
- SEO/meta: full OG/Twitter cards, JSON-LD Person schema, sitemap. The og-image uses the new identity.
- Screenshots in every UI PR (15c).
- Deploy: Vercel via git-linked integration (not CLI-push — new repo, no legacy constraint; deploy provenance free).

## Waves
- **Wave 1 — identity + skeleton**: tokens, logo/favicon/OG, page scaffold with typed content files populated from the manifest, deploy to Vercel preview. Gate: GG reviews identity + copy before wave 2.
- **Wave 2 — polish + gates**: responsive pass, a11y, budgets measured, SEO, real resume wired, prod deploy.
- **Wave 3 (later, post-arXiv)**: flip research section live with arXiv ID; add Tier 2 when public.

## Success criteria
- Live URL loads < 1.5 s LCP (measured, artifact committed).
- Every displayed number traceable in provenance.md.
- GG can send the URL in a job application the same week.
